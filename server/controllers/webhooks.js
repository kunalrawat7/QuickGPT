// import Stripe from 'stripe';
// import Transaction from '../models/Transaction.js';

// export const stripeWebhooks = async (request, response) => {
//     const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
//     const sig = request.headers["stripe-signature"]

//     let event;
    
//     try {
//         event = stripe.webhooks.constructEvent(request.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
//     } catch (error) {
//         return response.status(400).send(`Webhook Error: ${error.message}`)
//     }


//     try {
//         switch(event.type){
//             case "payment_intent.succeeded": {
//                 const paymentIntent = event.data.object;
//                 const sessionList = await stripe.checkout.sessions.list({
//                     payment_intent: paymentIntent.id,
//                 })

//                 const session = sessionList.data[0];
//                 const {transactionId, appId} = session.metadata;

//                 if(appId === 'quickgpt'){
//                     const transaction = await Transaction.findOne({_id: transactionId, isPaid: false})

//                     // Update credits in user account
//                     await User.updateOne({_id: transaction.userId}, {$inc:
//                         {credits: transaction.credits}})

//                     // Update credit payment status
//                     transaction.isPaid = true;
//                     await transaction.save();
//                 }else{
//                     return response.json({received: true, message: "Ignored event: Invalid app"})
//                 }
//                 break;
//             }
//             default:
//                 console.log("Unhandled event type:", event.type);
//                 break;
//         }
//         response.json({received: true})
//     } catch (error) {
//         console.error("Webhook processing error:", error)
//         response.status(500).send("Internal Server Error")
//     }
// }

import Stripe from "stripe";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const stripeWebhooks = async (req, res) => {
console.log("🔥 WEBHOOK HIT");
console.log("EVENT TYPE:", event.type);
    const sig = req.headers["stripe-signature"];

    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.log("❌ Signature Error:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        console.log("👉 EVENT TYPE:", event.type);

        if (event.type === "checkout.session.completed") {

            const session = event.data.object;

            console.log("👉 FULL SESSION:", session);
            console.log("👉 METADATA:", session.metadata);

            const transactionId = session.metadata?.transactionId;
            const appId = session.metadata?.appId;

            console.log("👉 Transaction ID:", transactionId);
            console.log("👉 App ID:", appId);

            if (!transactionId) {
                console.log("❌ No transactionId found in metadata");
                return res.json({ received: true });
            }

            if (appId !== "quickgpt") {
                console.log("❌ Invalid appId");
                return res.json({ received: true });
            }

            // 🔍 Check DB connection
            console.log("👉 DB URL:", process.env.MONGO_URI);

            const transaction = await Transaction.findById(transactionId);

            console.log("👉 Transaction from DB:", transaction);

            if (!transaction) {
                console.log("❌ Transaction NOT FOUND in DB");
                return res.json({ received: true });
            }

            if (transaction.isPaid) {
                console.log("⚠️ Already paid");
                return res.json({ received: true });
            }

            // ✅ Update user credits
            const userUpdate = await User.updateOne(
                { _id: transaction.userId },
                { $inc: { credits: transaction.credits } }
            );

            console.log("👉 User update result:", userUpdate);

            // ✅ Update transaction
            transaction.isPaid = true;
            await transaction.save();

            console.log("✅ Payment SUCCESS → isPaid updated");

        } else {
            console.log("⚠️ Unhandled event:", event.type);
        }

        res.json({ received: true });

    } catch (error) {
        console.log("❌ Webhook Processing Error:", error);
        res.status(500).send("Server Error");
    }
};