const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');

const User = require('../models/User');
const { GedcomDatabase } = require('../models/Gedcom');
const { authMiddleware } = require('../middleware/auth');
const { 
  generateVerificationCode, 
  generateEncryptionKey,
  validatePassword,
  validateBirthDate,
  validateCity,
  encryptData
} = require('../utils/helpers');
const { sendVerificationEmail } = require('../utils/emailService');
const { getGedcomStats } = require('../utils/gedcomParser');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/plain' || 
        file.originalname.toLowerCase().endsWith('.ged') ||
        file.originalname.toLowerCase().endsWith('.gedcom')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Please upload a GEDCOM file.'), false);
    }
  }
});

// Register with GEDCOM file
router.post('/register-gedcom', upload.single('gedcomFile'), [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match');
    }
    return true;
  }),
  body('givenNames').trim().isLength({ min: 1 }),
  body('familyNames').trim().isLength({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { email, password, givenNames, familyNames } = req.body;

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.message });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Validate GEDCOM file
    if (!req.file) {
      return res.status(400).json({ message: 'GEDCOM file is required' });
    }

    const gedcomContent = req.file.buffer.toString('utf8');
    if (!gedcomContent.trim()) {
      return res.status(400).json({ message: 'GEDCOM file is empty' });
    }

    // Basic GEDCOM validation (check for GEDCOM header)
    if (!gedcomContent.includes('0 HEAD') || !gedcomContent.includes('1 GEDC')) {
      return res.status(400).json({ 
        message: 'Invalid GEDCOM file format. Please upload a valid GEDCOM file.' 
      });
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();
    const verificationExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Create user (not yet saved)
    const user = new User({
      email,
      password,
      givenNames,
      familyNames,
      verificationCode,
      verificationExpires,
      encryptionKey: generateEncryptionKey(),
      hasGedcomFile: true
    });

    // Send verification email
    const emailResult = await sendVerificationEmail(email, verificationCode);
    if (!emailResult.success) {
      return res.status(500).json({ 
        message: 'Failed to send verification email. Please try again.' 
      });
    }

    // Store GEDCOM content in user document
    user.tempRegistrationData = {
      type: 'gedcomFile',
      content: gedcomContent,
      filename: req.file.originalname,
      expires: verificationExpires
    };

    // Save user and GEDCOM data temporarily (will be processed after verification)
    await user.save();

    res.status(200).json({
      message: 'Verification code sent to your email',
      userId: user._id,
      email: user.email,
      expiresIn: '5 minutes'
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      message: 'Registration failed. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Register without GEDCOM (first GEDCOM entry)
router.post('/register-first-gedcom', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match');
    }
    return true;
  }),
  body('givenNames').trim().isLength({ min: 1 }),
  body('familyNames').trim().isLength({ min: 1 }),
  body('birthDate').isISO8601(),
  body('birthCity').trim().isLength({ min: 2 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { email, password, givenNames, familyNames, birthDate, birthCity } = req.body;

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.message });
    }

    // Validate birth date
    const birthDateValidation = validateBirthDate(birthDate);
    if (!birthDateValidation.valid) {
      return res.status(400).json({ message: birthDateValidation.message });
    }

    // Validate city
    const cityValidation = validateCity(birthCity);
    if (!cityValidation.valid) {
      return res.status(400).json({ message: cityValidation.message });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();
    const verificationExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Create user (not yet saved)
    const user = new User({
      email,
      password,
      givenNames,
      familyNames,
      verificationCode,
      verificationExpires,
      encryptionKey: generateEncryptionKey(),
      hasGedcomFile: false
    });

    // Send verification email
    const emailResult = await sendVerificationEmail(email, verificationCode);
    if (!emailResult.success) {
      return res.status(500).json({ 
        message: 'Failed to send verification email. Please try again.' 
      });
    }

    // Save user
    await user.save();

    // Store first GEDCOM entry data in user document
    user.tempRegistrationData = {
      type: 'firstGedcom',
      givenNames,
      familyNames,
      birthDate,
      birthCity,
      expires: verificationExpires
    };
    
    console.log('Stored temp first GEDCOM data in user document:', user.tempRegistrationData);
    console.log('User ID that will receive verification:', user._id);

    // Save user with temp data
    await user.save();
    console.log('User saved with temp registration data');

    res.status(200).json({
      message: 'Verification code sent to your email',
      userId: user._id,
      email: user.email,
      expiresIn: '5 minutes'
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      message: 'Registration failed. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Verify email code
router.post('/verify-email', [
  body('userId').isMongoId(),
  body('verificationCode').isLength({ min: 6, max: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { userId, verificationCode } = req.body;
    
    console.log('Verification attempt:', {
      userId,
      providedCode: verificationCode,
      codeLength: verificationCode?.length
    });

    const user = await User.findById(userId);
    if (!user) {
      console.log('User not found:', userId);
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('User verification data:', {
      storedCode: user.verificationCode,
      expiresAt: user.verificationExpires,
      isExpired: new Date() > user.verificationExpires,
      currentTime: new Date(),
      isVerified: user.isVerified
    });
    
    console.log('User temp registration data:', user.tempRegistrationData);
    console.log('User hasGedcomFile:', user.hasGedcomFile);

    if (user.isVerified) {
      console.log('User already verified');
      return res.status(400).json({ message: 'User is already verified' });
    }

    if (!user.verificationCode || user.verificationCode !== verificationCode) {
      console.log('Code mismatch:', { stored: user.verificationCode, provided: verificationCode });
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    if (new Date() > user.verificationExpires) {
      console.log('Code expired');
      return res.status(400).json({ message: 'Verification code has expired' });
    }

    console.log('All validation checks passed, proceeding with verification...');

    // Mark user as verified
    user.isVerified = true;
    user.verificationCode = null;
    user.verificationExpires = null;
    
    // Generate GEDCOM database ID
    user.gedcomDatabaseId = user.generateGedcomDatabaseId();

    if (user.hasGedcomFile) {
      // Process uploaded GEDCOM file
      console.log('Processing GEDCOM file for user:', userId);
      const tempData = user.tempRegistrationData;
      console.log('Temp GEDCOM data exists:', !!tempData && tempData.type === 'gedcomFile');
      if (!tempData || tempData.type !== 'gedcomFile') {
        console.log('GEDCOM data not found or expired');
        return res.status(400).json({ message: 'GEDCOM data not found or expired' });
      }

      // Parse GEDCOM content
      console.log('Parsing GEDCOM file content...');
      const gedcomStats = getGedcomStats(tempData.content);
      console.log('GEDCOM parsing results:', {
        totalIndividuals: gedcomStats.totalIndividuals,
        totalFamilies: gedcomStats.totalFamilies,
        success: gedcomStats.success
      });

      // Create encrypted GEDCOM database
      const gedcomData = {
        individuals: gedcomStats.individuals,
        families: gedcomStats.families,
        sourceFile: tempData.filename,
        importDate: new Date(),
        rawGedcom: tempData.content,
        parseSuccess: gedcomStats.success,
        parseError: gedcomStats.error || null
      };

      const encryptedGedcom = encryptData(JSON.stringify(gedcomData), user.encryptionKey);

      const gedcomDb = new GedcomDatabase({
        databaseId: user.gedcomDatabaseId,
        userId: user._id,
        encryptedData: JSON.stringify(encryptedGedcom),
        sourceFile: tempData.filename,
        totalIndividuals: gedcomStats.totalIndividuals,
        totalFamilies: gedcomStats.totalFamilies
      });

      await gedcomDb.save();

    } else {
      // Process first GEDCOM entry
      console.log('Processing first GEDCOM entry for user:', userId);
      const tempData = user.tempRegistrationData;
      console.log('Temp first GEDCOM data exists:', !!tempData && tempData.type === 'firstGedcom');
      if (!tempData || tempData.type !== 'firstGedcom') {
        console.log('First GEDCOM data not found or expired');
        return res.status(400).json({ message: 'First GEDCOM data not found or expired' });
      }

      // Create initial GEDCOM database with first entry
      const gedcomData = {
        individuals: [{
          id: 'I1',
          givenNames: tempData.givenNames,
          familyNames: tempData.familyNames,
          birthDate: tempData.birthDate,
          birthPlace: tempData.birthCity,
          sex: 'U' // Unknown initially
        }],
        families: [],
        sourceFile: null,
        importDate: new Date(),
        createdManually: true
      };

      const encryptedGedcom = encryptData(JSON.stringify(gedcomData), user.encryptionKey);

      const gedcomDb = new GedcomDatabase({
        databaseId: user.gedcomDatabaseId,
        userId: user._id,
        encryptedData: JSON.stringify(encryptedGedcom),
        sourceFile: null,
        totalIndividuals: 1,
        totalFamilies: 0
      });

      await gedcomDb.save();
    }

    // Clean up temporary registration data
    user.tempRegistrationData = null;

    await user.save();
    console.log('User verification completed successfully');

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '30d' }
    );

    console.log('JWT token generated, sending success response');
    res.status(200).json({
      message: 'Email verified successfully. Your GEDCOM database is ready.',
      user: user.toJSON(),
      token
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ 
      message: 'Email verification failed. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(403).json({ 
        message: 'Please verify your email address before logging in' 
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '30d' }
    );

    res.status(200).json({
      message: 'Login successful',
      user: user.toJSON(),
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      message: 'Login failed. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  res.json({
    user: req.user.toJSON()
  });
});

// Logout (client-side token removal, but we can track it server-side if needed)
router.post('/logout', authMiddleware, async (req, res) => {
  // In a more sophisticated setup, we might maintain a blacklist of tokens
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;