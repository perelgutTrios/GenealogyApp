# Steve's Genealogy Tool

A comprehensive genealogy application with user registration, authentication, and GEDCOM file processing.

## Project Structure

- `frontend/` - React.js frontend application
- `backend/` - Node.js/Express backend API

## Features

- User registration with email verification
- Secure authentication with JWT
- GEDCOM file upload and processing
- Encrypted user data storage
- Modern responsive UI with Bootstrap

## Getting Started

### Backend Setup
```bash
cd backend
npm install
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

## Technology Stack

- **Frontend**: React.js, Bootstrap 5, JavaScript
- **Backend**: Node.js, Express.js, JWT
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT tokens, bcrypt password hashing
- **File Processing**: GEDCOM parsing and validation
- **Email**: Nodemailer for verification emails