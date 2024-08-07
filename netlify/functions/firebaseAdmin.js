const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://nail-art-by-gessica-default-rtdb.firebaseio.com',
  storageBucket: "nail-art-by-gessica.appspot.com"
});

const db = admin.firestore();
const auth = admin.auth();
const bucket = admin.storage().bucket();
const dbRealtime = admin.database();

module.exports = { admin, db, auth, bucket, dbRealtime };
