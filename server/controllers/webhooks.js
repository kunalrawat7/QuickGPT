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

    const sig = req.headers["stripe-signature"];
    let event;

    // ✅ Verify webhook signature
    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );

        console.log("👉 EVENT TYPE:", event.type);

    } catch (err) {
        console.log("❌ Signature Error:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        // ✅ Correct event for checkout flow
        if (event.type === "checkout.session.completed") {

            const session = event.data.object;

            console.log("👉 METADATA:", session.metadata);

            const transactionId = session.metadata?.transactionId;
            const appId = session.metadata?.appId;

            if (!transactionId) {
                console.log("❌ No transactionId found");
                return res.json({ received: true });
            }

            if (appId !== "quickgpt") {
                console.log("❌ Invalid appId");
                return res.json({ received: true });
            }

            // ✅ Find transaction
            const transaction = await Transaction.findById(transactionId);

            if (!transaction) {
                console.log("❌ Transaction NOT FOUND");
                return res.json({ received: true });
            }

            if (transaction.isPaid) {
                console.log("⚠️ Already paid");
                return res.json({ received: true });
            }

            // ✅ Update user credits
            await User.updateOne(
                { _id: transaction.userId },
                { $inc: { credits: transaction.credits } }
            );

            // ✅ Mark as paid
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