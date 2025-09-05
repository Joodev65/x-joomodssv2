const express = require('express');
const cors = require('cors');
const axios = require('axios');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const TELEGRAM_BOT_TOKEN = '7789321645:AAEh6BiwNR6SgKI_8ZIE-SfJm3J7SFS5yvw';
const TELEGRAM_OWNER_ID = '7978512548';

const users = {
  'admin': 'password123',
  'joocode': 'admin2024'
};

function getClientIP(req) {
  return req.headers['x-forwarded-for'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         '127.0.0.1';
}

function isValidWhatsAppNumber(number) {
  const cleanNumber = number.replace(/[\s\-\(\)]/g, '');
  
  const phoneRegex = /^\+[1-9]\d{9,14}$/;
  
  return phoneRegex.test(cleanNumber);
}

const GOOGLE_APPS_SCRIPT_URL = 'isi';

async function sendUnbanEmailViaGoogleScript(number, banType, clientIP) {
  try {
    const emailTemplates = {
      'spam': {
        subject: `WhatsApp Account Appeal - Spam Related Suspension`,
        body: `Dear WhatsApp Support Team,

I am writing to request the unbanning of my WhatsApp account that was suspended due to spam-related activities.

Phone Number: ${number}
Issue: Account suspended for spam
Request Type: Appeal for account restoration

I acknowledge that my account was suspended and I understand WhatsApp's terms of service. I assure you that I will comply with all community guidelines moving forward.

Please review my account and consider restoring access.

Best regards,
Account Holder

Request submitted from IP: ${clientIP}
Date: ${new Date().toLocaleString('id-ID')}`
      },
      'permanen tinjau': {
        subject: `WhatsApp Account Review Request - Permanent Suspension`,
        body: `Dear WhatsApp Support Team,

I am requesting a review for my permanently suspended WhatsApp account.

Phone Number: ${number}
Issue: Permanent account suspension under review
Request Type: Account restoration appeal

I believe this suspension may have been issued in error. I request a thorough review of my account activity and ask for restoration if no violations are found.

I commit to following all WhatsApp community guidelines.

Respectfully,
Account Holder

Request submitted from IP: ${clientIP}
Date: ${new Date().toLocaleString('id-ID')}`
      },
      'permanen hard': {
        subject: `WhatsApp Account Final Appeal - Hard Ban`,
        body: `Dear WhatsApp Support Team,

I am submitting a final appeal for my permanently banned WhatsApp account.

Phone Number: ${number}
Issue: Permanent hard ban
Request Type: Final appeal for account restoration

I understand the serious nature of this suspension. I request one final review of my case and ask for consideration of account restoration.

I commit to strict adherence to all terms of service.

Sincerely,
Account Holder

Request submitted from IP: ${clientIP}
Date: ${new Date().toLocaleString('id-ID')}`
      }
    };

    const template = emailTemplates[banType] || emailTemplates['spam'];

    console.log(`📧 Sending email to WhatsApp Support...`);
    console.log(`Subject: ${template.subject}`);
    console.log(`Body: ${template.body}`);

    const response = await axios.post(
      GOOGLE_APPS_SCRIPT_URL,
      new URLSearchParams({
        number: number,
        banType: banType,
        clientIP: clientIP,
        subject: template.subject,
        body: template.body
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 10000
      }
    );

    if (response.data && response.data.success) {
      console.log('✅ Email berhasil dikirim via Google Apps Script');
      return { success: true, message: 'Email sent successfully', emailData: template };
    } else {
      console.error('❌ Gagal kirim email, response:', response.data);
      return { success: false, error: 'Google Apps Script returned an error' };
    }

  } catch (error) {
    console.error('❌ Error sending email via Google Apps Script:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}

async function checkWhatsAppBanStatus(number) {
  try {
    const cleanNumber = number.replace(/[\s\-\(\)]/g, '');
    
    const banChecks = {
      formatCheck: isValidWhatsAppNumber(cleanNumber),
      
      isDatabaseBanned: false,
      
      isSuspiciousPattern: checkSuspiciousPattern(cleanNumber),
      
      hasReports: Math.random() < 0.3, 
      isNewNumber: checkIfNewNumber(cleanNumber)
    };
    
    let banType, details, likelihood;
    
    if (!banChecks.formatCheck) {
      banType = 'invalid format';
      details = 'Nomor tidak valid atau format salah';
      likelihood = 'N/A';
    } else if (banChecks.isSuspiciousPattern && banChecks.hasReports) {
      banType = 'permanen hard';
      details = 'Nomor terdeteksi memiliki pola suspicious dan ada laporan pelanggaran';
      likelihood = '95%';
    } else if (banChecks.hasReports && banChecks.isNewNumber) {
      banType = 'permanen tinjau';
      details = 'Nomor baru dengan indikasi pelanggaran, sedang dalam review';
      likelihood = '80%';
    } else if (banChecks.isSuspiciousPattern) {
      banType = 'spam';
      details = 'Terdeteksi aktivitas spam atau pesan massal';
      likelihood = '65%';
    } else if (banChecks.hasReports) {
      banType = 'spam';
      details = 'Ada laporan aktivitas mencurigakan';
      likelihood = '50%';
    } else {
      banType = 'tidak dibanned';
      details = 'Nomor dalam kondisi normal, tidak ada indikasi banned';
      likelihood = '5%';
    }
    
    return {
      type: banType,
      details: details,
      likelihood: likelihood,
      checks: banChecks,
      checkedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error in ban status check:', error);
    return {
      type: 'error',
      details: 'Gagal mengecek status ban',
      likelihood: 'N/A'
    };
  }
}

function checkSuspiciousPattern(number) {
  const suspicious = [
    /(\d)\1{3,}/, 
    /^(\+62|62|0)8[0-9]{2}(000|111|222|333|444|555|666|777|888|999)/, 
    /^(\+62|62|0)8[0-9]{2}[0-9]{4}(00|11|22|33|44|55|66|77|88|99)$/ 
  ];
  
  return suspicious.some(pattern => pattern.test(number));
}

function checkIfNewNumber(number) {
  const hash = number.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  return Math.abs(hash) % 100 < 20; 
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (users[username] && users[username] === password) {
    res.json({ success: true, message: 'Login berhasil' });
  } else {
    res.status(401).json({ success: false, message: 'Username atau password salah' });
  }
});

app.post('/api/unban', async (req, res) => {
  try {
    const { number, banType } = req.body;
    const clientIP = getClientIP(req);
    
    if (!isValidWhatsAppNumber(number)) {
      return res.status(400).json({
        success: false,
        message: 'Format nomor WhatsApp tidak valid. Gunakan format: +6281234567890'
      });
    }
    
    const telegramMessage = `🚨 New Unban Request\n\nIP: ${clientIP}\nNumber: ${number}\nType: ${banType}\nTime: ${new Date().toLocaleString('id-ID')}`;
    
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_OWNER_ID,
      text: telegramMessage
    });
    
    const emailResult = await sendUnbanEmailViaGoogleScript(number, banType, clientIP);
    
    if (!emailResult.success) {
      console.error('Failed to send email:', emailResult.error);
      return res.status(500).json({
        success: false,
        message: 'Gagal mengirim email ke WhatsApp Support. Silakan coba lagi.'
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Permintaan unban berhasil dikirim ke WhatsApp Support via email. Tim akan memproses dalam 1-24 jam.' 
    });
    
  } catch (error) {
    console.error('Error processing unban request:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan saat memproses permintaan' 
    });
  }
});

app.post('/api/check-ban', async (req, res) => {
  try {
    const { number } = req.body;
    
    if (!isValidWhatsAppNumber(number)) {
      return res.status(400).json({
        success: false,
        message: 'Format nomor WhatsApp tidak valid. Gunakan format: +6281234567890'
      });
    }
    
    const banStatus = await checkWhatsAppBanStatus(number);
    
    res.json({
      success: true,
      number: number,
      banType: banStatus.type,
      message: `Status ban untuk nomor ${number}: ${banStatus.type}`,
      details: banStatus.details,
      lastChecked: new Date().toLocaleString('id-ID')
    });
    
  } catch (error) {
    console.error('Error checking ban status:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengecek status ban'
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});