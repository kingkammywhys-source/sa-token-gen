const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

// In-memory store for active tokens (Use Redis/Postgres for production scale)
const tokenStore = new Map();

// Generate a valid Luhn-compliant PAN starting with a standard AU Corporate BIN
function generateValidPAN() {
    // Common AU Corporate BINs: 456xxx (Visa), 520xxx (Mastercard)
    const bin = Math.random() > 0.5 ? '456789' : '520123';
    let pan = bin;
    
    // Generate random digits
    for (let i = 0; i < 8; i++) {
        pan += Math.floor(Math.random() * 10);
    }
    
    // Calculate Luhn Check Digit
    let sum = 0;
    let doubleDigit = false;
    
    for (let i = pan.length - 1; i >= 0; i--) {
        let digit = parseInt(pan[i]);
        if (doubleDigit) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        doubleDigit = !doubleDigit;
    }
    
    const checkDigit = (10 - (sum % 10)) % 10;
    return pan + checkDigit;
}

// Endpoint to generate a new corporate card token
app.post('/api/generate', (req, res) => {
    const sessionId = uuidv4();
    const pan = generateValidPAN();
    const expiry = '12/28'; // Standard future expiry
    const cvv = Math.floor(100 + Math.random() * 900).toString();
    const encryptionKey = crypto.randomBytes(32).toString('hex');
    
    const cardData = {
        id: sessionId,
        pan: pan.replace(/(.{4})/g, '$1 ').trim(), // Format for display
        rawPan: pan,
        expiry: expiry,
        cvv: cvv,
        encryptionKey: encryptionKey,
        status: 'ACTIVE',
        issuer: 'SA Corporate',
        country: 'AU-SA',
        createdAt: new Date().toISOString()
    };
    
    // Store in memory
    tokenStore.set(sessionId, cardData);
    
    res.json({
        success: true,
        message: 'Corporate token generated successfully.',
        data: cardData
    });
});

// Endpoint to verify a token (for Android HCE bridge)
app.get('/api/verify/:sessionId', (req, res) => {
    const card = tokenStore.get(req.params.sessionId);
    if (card) {
        res.json({ valid: true, card: card });
    } else {
        res.status(404).json({ valid: false, message: 'Token not found or expired.' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'online', service: 'SA-TOKEN-GEN' });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`SA Token Generator running on port ${PORT}`);
});