const crypto = require('crypto');

// Generate a random 6-digit verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate a secure random key for encryption
const generateEncryptionKey = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Encrypt data
const encryptData = (text, key) => {
  try {
    const algorithm = 'aes-256-cbc';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(key, 'hex'), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted,
      iv: iv.toString('hex')
    };
  } catch (error) {
    throw new Error('Encryption failed: ' + error.message);
  }
};

// Decrypt data
const decryptData = (encryptedData, key) => {
  try {
    const algorithm = 'aes-256-cbc';
    const decipher = crypto.createDecipheriv(algorithm, Buffer.from(key, 'hex'), Buffer.from(encryptedData.iv, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Decryption failed: ' + error.message);
  }
};

// Validate password strength
const validatePassword = (password) => {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  
  if (!/(?=.*[a-z])/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  
  if (!/(?=.*[A-Z])/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  
  if (!/(?=.*\d)/.test(password)) {
    return { valid: false, message: 'Password must contain at least one digit' };
  }
  
  return { valid: true };
};

// Validate birth date (must be at least 13 years ago)
const validateBirthDate = (birthDate) => {
  try {
    const birth = new Date(birthDate);
    const now = new Date();
    const thirteenYearsAgo = new Date(now.getFullYear() - 13, now.getMonth(), now.getDate());
    
    if (birth > thirteenYearsAgo) {
      return { valid: false, message: 'Birth date must be at least 13 years ago' };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, message: 'Invalid birth date format' };
  }
};

// Basic city validation (just check if it's not empty and has reasonable length)
const validateCity = (city) => {
  if (!city || city.trim().length < 2) {
    return { valid: false, message: 'Please enter a valid city name' };
  }
  
  if (city.length > 100) {
    return { valid: false, message: 'City name is too long' };
  }
  
  return { valid: true };
};

module.exports = {
  generateVerificationCode,
  generateEncryptionKey,
  encryptData,
  decryptData,
  validatePassword,
  validateBirthDate,
  validateCity
};