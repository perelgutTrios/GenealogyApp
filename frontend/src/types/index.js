// Type definitions for JavaScript - used for documentation only
// No exports needed since JavaScript doesn't use type checking

// User object structure:
// {
//   _id: string,
//   email: string,
//   givenNames: string,
//   familyNames: string,
//   isVerified: boolean,
//   hasGedcomFile: boolean,
//   gedcomDatabaseId: string (optional),
//   createdAt: string,
//   lastLogin: string (optional)
// }

// AuthResponse object structure:
// {
//   message: string,
//   user: User,
//   token: string
// }

// RegisterData object structure:
// {
//   email: string,
//   password: string,
//   confirmPassword: string,
//   givenNames: string,
//   familyNames: string,
//   gedcomFile: File (optional)
// }

// FirstGedcomData object structure:
// {
//   email: string,
//   password: string,
//   confirmPassword: string,
//   givenNames: string,
//   familyNames: string,
//   birthDate: string,
//   birthCity: string
// }

// VerificationData object structure:
// {
//   userId: string,
//   verificationCode: string
// }

// LoginData object structure:
// {
//   email: string,
//   password: string
// }

// ApiError object structure:
// {
//   message: string,
//   errors: Array (optional)
// }

// GedcomStats object structure:
// {
//   databaseId: string,
//   version: string,
//   sourceFile: string (optional),
//   totalIndividuals: number,
//   totalFamilies: number,
//   lastModified: string,
//   createdAt: string
// }