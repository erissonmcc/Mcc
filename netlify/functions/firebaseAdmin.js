const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://nail-art-by-gessica-default-rtdb.firebaseio.com'
});

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };
