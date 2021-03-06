import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express = require('express');
import {subDays, startOfDay, addHours, getTime} from 'date-fns';


admin.initializeApp();
const db = admin.firestore();
const app = express();

/**
 * Convert hex from Sigfox to int.
 * Weird function but it works.
 */
function hex_to_ascii(str1: string): Number {
  var hex  = str1.toString();
  var str = '';
  for (var n = 0; n < hex.length; n += 2) {
      str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
  }
  return parseInt(str);
}

/**
 *
 * Catch Errors Handler
 * With async/await, you need some way to catch errors
 * Instead of using try{} catch(e) {} in each controller, we wrap the function in
 * catchErrors(), catch and errors they throw, and pass it along to our express middleware with next()
 *
 */
export const catchErrors = function (fn: any) {
  return (req: express.Request, res: express.Response, next: any) => {
    // fn(req, res, next).catch(next).then(next());
    if (!fn || typeof fn !== 'function') {
      throw new Error('fn is not a function')
    }

    fn(req, res, next).catch(next)
  }
}

app.post('/push/electricity', catchErrors(async (req: express.Request, res: express.Response) => {
  const now = Date.now();
  const collection = db.collection('arduino_electricity_push');

  const body = req.body;

  if (!body.data) {
    return res.sendStatus(400);
  }

  await collection.add({
    'created_time': now,
    kw_per_hour: hex_to_ascii(body.data),
  });

  return res.sendStatus(201);
}));


/**
 * Generate fake data
 */
app.post('/push/generate', catchErrors(async (req: express.Request, res: express.Response) => {
  // min and max included
  function randomIntFromInterval(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  const data = [];

  const dayNb = 15;
  const now = new Date();

  // Every day, generate for x days
  for (let day = 0; day < dayNb; day++) {

    const dayDate = startOfDay(subDays(now, dayNb - day));

    // Every hour
    for (let hour = 0; hour < 23; hour++) {
      const dayHourDate = addHours(dayDate, hour);
      const conso = randomIntFromInterval(1, 14);

      data.push({
        created_time: getTime(dayHourDate),
        kw_per_hour: conso
      });

    }
  }

  const batch = db.batch();

  data.forEach((doc) => {
    //automatically generate unique id
    const docRef = db.collection("arduino_electricity_push_test").doc();
    batch.set(docRef, doc);
  });

  await batch.commit();

  return res.sendStatus(201);
}));

// Expose Express API as a single Cloud Function:
export const arduino = functions.https.onRequest(app);

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });
