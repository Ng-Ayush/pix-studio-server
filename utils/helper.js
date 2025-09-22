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


exports.getOtpEmailTemplate = (otp, adminName) => {
  return `
 <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My Studio Email Template</title>
  <style>
    body {
      background: #f4f6f8;
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #333;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 420px;
      margin: 48px auto;
      background: aliceblue;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      overflow: hidden;
      text-align: center;
      padding: 40px 32px 28px 32px;
    }
    .logo-img {
      width: 96px;
      margin-bottom: 16px;
    }
    h2 {
      color: #2980ef;
      margin-bottom: 10px;
      font-size: 1.55em;
    }
    .otp-card {
      margin: 24px auto 20px;
      padding: 18px 0;
      width: 180px;
      background: #eaf2fa;
      border-radius: 10px;
      font-size: 2em;
      letter-spacing: 12px;
      color: #202f50;
      font-weight: 600;
      box-shadow: 0 2px 12px rgba(41,128,239,0.07);
      text-align: center;
      user-select: all;
      border: 2px solid #d4e2f8;
    }
    .desc {
      font-size: 1em;
      color: #444;
      margin-bottom: 18px;
    }
    .footer {
      font-size: 0.92em;
      color: #888;
      margin-top: 30px;
    }
    @media (max-width: 480px) {
      .container {
        padding: 18px 8px 12px 8px;
      }
      .otp-card {
        width: 120px;
        font-size: 1.4em;
        padding: 10px 0;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <img src="https://firebasestorage.googleapis.com/v0/b/surajproductions-3f28b.firebasestorage.app/o/default%20assets%2Fgif_logo.gif?alt=media&token=c9c0ddf3-777d-49e8-b181-05bf58661d6a" alt="Suraj Studio Logo" class="logo-img">
    <div style="font-size:1.16em; font-weight:600; color:#2c365c; margin-bottom:10px;">MY STUDIO</div>
    <h2>Hello ${adminName},</h2>
    <div class="desc">Your One-Time Password (OTP) for verification is:</div>
    <div class="otp-card">${otp}</div>
    <div class="desc">This OTP is valid for 5 minutes.<br>If you did not request this, please ignore this email.</div>
    <div class="footer">
      Thank you,<br>
      My Studio Team
    </div>
  </div>
</body>
</html>

  `;
};

exports.globalInvoiceItems = () => {
return  [
    {
      item_name: "Silver Package (Wedding)",
      description: "40 Sheet Matalic Album Traditional Photo+ Video+2-2.30Hours Video+ 50 Photos Edited+ 2 Frame 12x18",
      sale_price: 40000
    },
    {
      item_name: "Gold Package (Wedding)",
      description: "50 Sheet Matalic Album Traditional Photo+ Video+Cineamtic & Candid+ 2-2.30Hours Video+ 50 Photos Edited+ 2 Frame 16x20",
      sale_price: 60000
    },
    {
      item_name: "Platinum Package (Wedding)",
      description: "50 Sheet Matalic Album Traditional Photo+ Video+Cineamtic & Candid+ Drone+ 2-2.30 Hours Video+ 200 Photos Edited+ 2 Frame 20x24+ 1 Callender",
      sale_price: 90000
    },
    {
      item_name: "Traditional Videographer (Wedding)",
      description: "Single Day Shoot Mirrorless Camera 1 Videographer",
      sale_price: 15000
    },
    {
      item_name: "Traditional Photographer (Wedding)",
      description: "Single Day Shoot Mirrorless Camera 1 Photographer",
      sale_price: 15000
    },
    {
      item_name: "Candid Photography",
      description: "1 Candid Photographer (8 Hours Shoot)",
      sale_price: 15000
    },
    {
      item_name: "Cinematic Videos",
      description: "1 Cineamtographer (8 Hours Shoot)",
      sale_price: 15000
    },
    {
      item_name: "Drone Camera",
      description: "Single Day Shoot",
      sale_price: 6000
    },
    {
      item_name: "Led Wall Screen",
      description: "Single Day (6 Hours Service)",
      sale_price: 10000
    },
    {
      item_name: "Crane+ 4 Led",
      description: "Single Day (6 Hours Service)",
      sale_price: 10000
    },
    {
      item_name: "Led Frames (4pcs)",
      description: "Single Day (6 Hours Service)",
      sale_price: 5000
    },
    {
      item_name: "Haldi Shoot",
      description: "Single Day Traditional Photo+ Video (6 Hours Service)",
      sale_price: 8000
    },
    {
      item_name: "Premium Haldi Shoot",
      description: "Single Day Traditional Photo+ Video+Cinematic & Candid (6 Hours Service)",
      sale_price: 15000
    },
    {
      item_name: "Tilak Ceremony (Package01)",
      description: "Single Team _Traditional Photo+ Video(6 Hours Service)",
      sale_price: 10000
    },
    {
      item_name: "Tilak Ceremony (Package02)",
      description: "2 Traditional Photographer+ Video (6 Hours Service)",
      sale_price: 15000
    },
    {
      item_name: "Extra Camera",
      description: "6 hours Service",
      sale_price: 6000
    },
    {
      item_name: "Silver Package (Engagement)",
      description: "20 Sheet Matalic Album Traditional Photo+ Video",
      sale_price: 15000
    },
    {
      item_name: "Gold Package (Engagement)",
      description: "25 Sheet Matalic Album Traditional Photo+ Video & Candid+ Teaser Videos",
      sale_price: 25000
    },
    {
      item_name: "Platinum Package (Engagement)",
      description: "40 Sheet Matalic Album Traditional Photo+ Video+Cineamtic & Candid",
      sale_price: 4000
    },
    {
      item_name: "AI FACE_ RECOGNIZATION LIVE SHARING",
      description: "AI FACE_ RECOGNIZATION LIVE SHARING WITH 1 PHOTOGRAPHER",
      sale_price: 10000
    },
    {
      item_name: "Pre-Wedding Shoot",
      description: "Single Day Shoot 100kms",
      sale_price: 25000
    }
  ];
}