import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
    apiKey: "AIzaSyDKphWI0sjueBEgQuBV711VOj-wftqcN7I",
    authDomain: "school-lunch-876ba.firebaseapp.com",
    projectId: "school-lunch-876ba",
    storageBucket: "school-lunch-876ba.firebasestorage.app",
    messagingSenderId: "400613113450",
    appId: "1:400613113450:web:4b58a1a4f737527d8f5413",
    measurementId: "G-TN72FPTPS0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getDatabase(app);
