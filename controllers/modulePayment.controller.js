const crypto = require('crypto');
const pool = require('../db_config/db.js');
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const getCurrentPlan = async (executor, userId) => {
    const [[user]] = await executor.execute(
        `SELECT allowed_photos_quantity, used_photo_count, access_expires_on
         FROM users WHERE id = ?`,
        [userId]
    );

    if (!user) {
        return null;
    }

    const [moduleAccess] = await executor.execute(
        `SELECT module_code, MAX(module_expires_on) AS expires_on
         FROM module_payments
         WHERE user_id = ? AND payment_status = 'paid'
         GROUP BY module_code`,
        [userId]
    );
    const [[activeAccess]] = await executor.execute(
        `SELECT MAX(module_expires_on) AS expires_on
         FROM module_payments
         WHERE user_id = ? AND payment_status = 'paid'
           AND module_code IN ('all_features', 'ai_photo_sharing')
           AND module_expires_on >= CURDATE()`,
        [userId]
    );
    const [[latestPurchase]] = await executor.execute(
        `SELECT plan_name, amount, photo_quantity, duration_days, paid_at
         FROM module_payments
         WHERE user_id = ? AND payment_status = 'paid'
         ORDER BY paid_at DESC, id DESC
         LIMIT 1`,
        [userId]
    );

    const allowedPhotoQuantity = Number(user.allowed_photos_quantity || 0);
    const usedPhotoCount = Number(user.used_photo_count || 0);

    return {
        allowedPhotoQuantity,
        usedPhotoCount,
        remainingPhotoQuantity: Math.max(allowedPhotoQuantity - usedPhotoCount, 0),
        accessExpiresOn: user.access_expires_on,
        moduleAccessExpiresOn: activeAccess?.expires_on || null,
        latestPurchase: latestPurchase || null,
        moduleAccess,
    };
};

const normalizePlan = (plan) => ({
    id: Number(plan.id),
    name: plan.name,
    price: Number(plan.price),
    photoQuantity: Number(plan.photo_quantity),
    durationDays: Number(plan.duration_days),
    isActive: Number(plan.is_active) === 1,
});

const getActivePlans = async () => {
    const [plans] = await pool.execute(
        'SELECT id, name, price, photo_quantity, duration_days, is_active FROM module_plans WHERE is_active = 1 ORDER BY price ASC, id ASC'
    );
    return plans.map(normalizePlan);
};

const sendCurrentPlan = async (res, executor, userId) => {
    const currentPlan = await getCurrentPlan(executor, userId);
    if (!currentPlan) {
        return res.status(404).send({ status: 404, message: 'User not found.' });
    }

    return res.send({ status: 200, data: { currentPlan } });
};

exports.createOrder = async (req, res) => {
    try {
        const planId = Number(req.body?.planId);
        if (!Number.isSafeInteger(planId) || planId < 1) {
            return res.status(400).send({ status: 400, message: 'Invalid module package.' });
        }
        const [[storedPlan]] = await pool.execute(
            'SELECT * FROM module_plans WHERE id = ? AND is_active = 1',
            [planId]
        );
        if (!storedPlan) {
            return res.status(400).send({ status: 400, message: 'This plan is unavailable.' });
        }
        const plan = normalizePlan(storedPlan);
        const moduleCode = 'all_features';

        const order = await razorpay.orders.create({
            amount: Math.round(plan.price * 100),
            currency: 'INR',
            receipt: `mod_${req.user.id}_${Date.now()}`,
            notes: {
                user_id: String(req.user.id),
                module_code: moduleCode,
                plan_id: String(plan.id),
            },
        });

        await pool.execute(
            `INSERT INTO module_payments
             (user_id, module_code, plan_code, plan_name, amount, photo_quantity, duration_days,
              razorpay_order_id, payment_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'created')`,
            [
                req.user.id,
                moduleCode,
                String(plan.id),
                plan.name,
                plan.price,
                plan.photoQuantity,
                plan.durationDays,
                order.id,
            ]
        );

        return res.send({
            status: 200,
            message: 'Order created successfully.',
            data: {
                ...order,
                plan: {
                    id: plan.id,
                    name: plan.name,
                    amount: plan.price,
                    photoQuantity: plan.photoQuantity,
                    durationDays: plan.durationDays,
                },
            },
        });
    } catch (error) {
        console.error('Failed to create module payment order:', error);
        return res.status(500).send({
            status: 500,
            error: 'Unable to create payment order.',
            message: 'Unable to create payment order.',
        });
    }
};

exports.verifyPayment = async (req, res) => {
    const {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
    } = req.body || {};

    if (![orderId, paymentId, signature].every(value => typeof value === 'string' && value.length > 0)) {
        return res.status(400).send({ status: 400, message: 'Payment verification details are required.' });
    }

    let connection;
    try {
        const [orders] = await pool.execute(
            `SELECT id, module_code, amount, payment_status, razorpay_payment_id
             FROM module_payments
             WHERE razorpay_order_id = ? AND user_id = ?`,
            [orderId, req.user.id]
        );
        const order = orders[0];
        if (!order) {
            return res.status(404).send({ status: 404, message: 'Payment order not found.' });
        }

        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${orderId}|${paymentId}`)
            .digest('hex');
        const receivedSignatureBuffer = Buffer.from(signature, 'hex');
        const expectedSignatureBuffer = Buffer.from(expectedSignature, 'hex');

        if (
            receivedSignatureBuffer.length !== expectedSignatureBuffer.length ||
            !crypto.timingSafeEqual(receivedSignatureBuffer, expectedSignatureBuffer)
        ) {
            return res.status(400).send({ status: 400, message: 'Invalid payment signature.' });
        }

        if (order.payment_status === 'paid') {
            if (order.razorpay_payment_id !== paymentId) {
                return res.status(409).send({ status: 409, message: 'Order was already verified with another payment.' });
            }

            return await sendCurrentPlan(res, pool, req.user.id);
        }

        const payment = await razorpay.payments.fetch(paymentId);
        const expectedAmount = Math.round(Number(order.amount) * 100);
        if (
            payment.order_id !== orderId ||
            payment.amount !== expectedAmount ||
            payment.currency !== 'INR' ||
            payment.status !== 'captured'
        ) {
            return res.status(400).send({ status: 400, message: 'Razorpay payment is not captured for this order.' });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [lockedOrders] = await connection.execute(
            `SELECT id, module_code, photo_quantity, duration_days, amount,
                    payment_status, razorpay_payment_id
             FROM module_payments
             WHERE razorpay_order_id = ? AND user_id = ?
             FOR UPDATE`,
            [orderId, req.user.id]
        );
        const lockedOrder = lockedOrders[0];

        if (!lockedOrder) {
            await connection.rollback();
            return res.status(404).send({ status: 404, message: 'Payment order not found.' });
        }

        if (lockedOrder.payment_status === 'paid') {
            if (lockedOrder.razorpay_payment_id !== paymentId) {
                await connection.rollback();
                return res.status(409).send({ status: 409, message: 'Order was already verified with another payment.' });
            }

            await connection.commit();
            return await sendCurrentPlan(res, pool, req.user.id);
        }

        const [lockedUsers] = await connection.execute(
            'SELECT id FROM users WHERE id = ? FOR UPDATE',
            [req.user.id]
        );
        if (!lockedUsers.length) {
            await connection.rollback();
            return res.status(404).send({ status: 404, message: 'User not found.' });
        }

        const photoQuantity = lockedOrder.photo_quantity;
        const [userUpdate] = await connection.execute(
            `UPDATE users
             SET allowed_photos_quantity = COALESCE(allowed_photos_quantity, 0) + ?,
                 access_expires_on = DATE_ADD(
                     GREATEST(COALESCE(access_expires_on, CURDATE()), CURDATE()),
                     INTERVAL ? DAY
                 )
             WHERE id = ?`,
            [photoQuantity, lockedOrder.duration_days, req.user.id]
        );

        if (userUpdate.affectedRows !== 1) {
            await connection.rollback();
            return res.status(404).send({ status: 404, message: 'User not found.' });
        }

        const [[updatedUser]] = await connection.execute(
            'SELECT access_expires_on FROM users WHERE id = ?',
            [req.user.id]
        );
        await connection.execute(
            `UPDATE module_payments
             SET payment_status = 'paid',
                 razorpay_payment_id = ?,
                 paid_at = CURRENT_TIMESTAMP,
                 module_expires_on = ?,
                 account_expires_on = ?
             WHERE id = ?`,
            [
                paymentId,
                updatedUser.access_expires_on,
                updatedUser.access_expires_on,
                lockedOrder.id,
            ]
        );

        const currentPlan = await getCurrentPlan(connection, req.user.id);
        await connection.commit();

        return res.send({
            status: 200,
            message: 'Payment verified and module access updated.',
            data: { currentPlan },
        });
    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Failed to roll back module payment:', rollbackError);
            }
        }
        console.error('Failed to verify module payment:', error);
        return res.status(500).send({
            status: 500,
            error: 'Unable to verify payment.',
            message: 'Unable to verify payment.',
        });
    } finally {
        connection?.release();
    }
};

exports.getPaymentSummary = async (req, res) => {
    try {
        const currentPlan = await getCurrentPlan(pool, req.user.id);
        if (!currentPlan) {
            return res.status(404).send({ status: 404, message: 'User not found.' });
        }

        const [transactions] = await pool.execute(
            `SELECT id, module_code, plan_code, amount, photo_quantity, duration_days,
                    plan_name,
                    razorpay_order_id, razorpay_payment_id, payment_status,
                    paid_at, module_expires_on, account_expires_on, created_at
             FROM module_payments
             WHERE user_id = ?
             ORDER BY created_at DESC, id DESC`,
            [req.user.id]
        );

        return res.send({
            status: 200,
            data: { currentPlan, transactions, plans: await getActivePlans() },
        });
    } catch (error) {
        console.error('Failed to fetch module payment summary:', error);
        return res.status(500).send({
            status: 500,
            error: 'Unable to fetch payment history.',
            message: 'Unable to fetch payment history.',
        });
    }
};

exports.getPlans = async (req, res) => {
    try {
        return res.send({ status: 200, data: await getActivePlans() });
    } catch (error) {
        console.error('Failed to fetch module plans:', error);
        return res.status(500).send({
            status: 500,
            message: 'Unable to fetch plans.',
        });
    }
};

exports.getAdminPlans = async (req, res) => {
    try {
        const [plans] = await pool.execute(
            'SELECT id, name, price, photo_quantity, duration_days, is_active FROM module_plans ORDER BY id DESC'
        );
        return res.send({ status: 200, data: plans.map(normalizePlan) });
    } catch (error) {
        console.error('Failed to fetch admin module plans:', error);
        return res.status(500).send({ status: 500, message: 'Unable to fetch plans.' });
    }
};

const validatePlanInput = (body) => {
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const price = Number(body?.price);
    const photoQuantity = Number(body?.photoQuantity);
    const durationDays = Number(body?.durationDays);
    if (
        !name || name.length > 120 ||
        !Number.isFinite(price) || price <= 0 || price > 10000000 ||
        !Number.isSafeInteger(photoQuantity) || photoQuantity <= 0 ||
        !Number.isSafeInteger(durationDays) || durationDays <= 0
    ) {
        return null;
    }
    return { name, price, photoQuantity, durationDays };
};

exports.createPlan = async (req, res) => {
    const plan = validatePlanInput(req.body);
    if (!plan) {
        return res.status(400).send({ status: 400, message: 'Enter a valid plan name, price, photo quantity, and duration.' });
    }

    try {
        const [result] = await pool.execute(
            'INSERT INTO module_plans (name, price, photo_quantity, duration_days) VALUES (?, ?, ?, ?)',
            [plan.name, plan.price, plan.photoQuantity, plan.durationDays]
        );
        const [[created]] = await pool.execute(
            'SELECT id, name, price, photo_quantity, duration_days, is_active FROM module_plans WHERE id = ?',
            [result.insertId]
        );
        return res.status(201).send({ status: 201, data: normalizePlan(created), message: 'Plan created.' });
    } catch (error) {
        console.error('Failed to create module plan:', error);
        return res.status(500).send({ status: 500, message: 'Unable to create plan.' });
    }
};

exports.updatePlan = async (req, res) => {
    const plan = validatePlanInput(req.body);
    const id = Number(req.params.id);
    if (!plan || !Number.isSafeInteger(id) || id < 1) {
        return res.status(400).send({ status: 400, message: 'Enter a valid plan.' });
    }

    try {
        const [result] = await pool.execute(
            'UPDATE module_plans SET name = ?, price = ?, photo_quantity = ?, duration_days = ? WHERE id = ?',
            [plan.name, plan.price, plan.photoQuantity, plan.durationDays, id]
        );
        if (!result.affectedRows) {
            return res.status(404).send({ status: 404, message: 'Plan not found.' });
        }
        const [[updated]] = await pool.execute(
            'SELECT id, name, price, photo_quantity, duration_days, is_active FROM module_plans WHERE id = ?',
            [id]
        );
        return res.send({ status: 200, data: normalizePlan(updated), message: 'Plan updated.' });
    } catch (error) {
        console.error('Failed to update module plan:', error);
        return res.status(500).send({ status: 500, message: 'Unable to update plan.' });
    }
};

exports.deletePlan = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).send({ status: 400, message: 'Invalid plan.' });
    }

    try {
        const [result] = await pool.execute(
            'UPDATE module_plans SET is_active = 0 WHERE id = ?',
            [id]
        );
        if (!result.affectedRows) {
            return res.status(404).send({ status: 404, message: 'Plan not found.' });
        }
        return res.send({ status: 200, message: 'Plan deactivated.' });
    } catch (error) {
        console.error('Failed to deactivate module plan:', error);
        return res.status(500).send({ status: 500, message: 'Unable to deactivate plan.' });
    }
};

exports.togglePlan = async (req, res) => {
    const id = Number(req.params.id);
    const isActive = req.body?.isActive;
    if (!Number.isSafeInteger(id) || id < 1 || typeof isActive !== 'boolean') {
        return res.status(400).send({ status: 400, message: 'Invalid plan status.' });
    }
    try {
        const [result] = await pool.execute(
            'UPDATE module_plans SET is_active = ? WHERE id = ?',
            [isActive ? 1 : 0, id]
        );
        if (!result.affectedRows) {
            return res.status(404).send({ status: 404, message: 'Plan not found.' });
        }
        return res.send({ status: 200, message: 'Plan status updated.' });
    } catch (error) {
        console.error('Failed to update module plan status:', error);
        return res.status(500).send({ status: 500, message: 'Unable to update plan status.' });
    }
};
