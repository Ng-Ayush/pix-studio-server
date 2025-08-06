exports.generateCustomerId = () => {
    return Math.floor(1000000 + Math.random() * 9000000).toString();
};
exports.generateCoupleNameUniqueCode = (name, phone) => {
    const words = name.trim().split(/\s+/);
    let initials = '';
    initials += words[0] ? words[0][0].toUpperCase() : '';
    initials += words[1] ? words[1][0].toUpperCase() : '';
    if (initials.length < 2) {
        initials = (initials + 'X').slice(0, 2);
    }
    const digits = phone.replace(/\D/g, ''); // Remove non-digit characters
    const last4 = digits.length >= 4 ? digits.slice(-4) : digits.padStart(4, '0');
    return initials + last4;
};
exports.generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000);
};
