const express = require('express')
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const SSLCommerzPayment = require('sslcommerz-lts')
require('dotenv').config();
const cors = require('cors')
const bcrypt =require('bcryptjs')
const jwt =require('jsonwebtoken')

const port = process.env.PORT || 5000


// middleware ---- use
const corsOptions = {
    origin: ['http://localhost:5173','https://e-commerce-bazar.web.app'],
    credentials: true,
    optionSuccessStatus: 200,
}

app.use(cors(corsOptions))
app.use(express.json())

// mongodb db uri -----------------------

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8ldebrq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASS;
const is_live = false //true for live, false for sandbox


async function run() {
    try {

        const productsDb = client.db("e-commerce-bazar").collection('products')
        const usersDb = client.db("e-commerce-bazar").collection('users')
        const commentsDb = client.db("e-commerce-bazar").collection('comments')
        const cartsDb = client.db("e-commerce-bazar").collection('carts')
        const productOrdersDb = client.db("e-commerce-bazar").collection('orders')



        const verifyToken = (req, res, next) => {
            const token = req.headers.authorization;
            if (!token) {
                return res.status(401).json({ message: "Unauthorized access" });
            }
            jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).json({ message: "Invalid token" });
                }
                req.userId = decoded.userId;
                next();
            });
        };

//        // Route to fetch user profile
// app.get('/user', verifyToken, async (req, res) => {
//     try {
//         const { _id } = req.query;
//         // Check if _id parameter is provided
//         if (!_id) {
//             return res.status(400).json({ message: "User ID not provided" });
//         }
//         // Fetch user data from the database based on _id
//         const userData = await usersDb.findOne({ _id });
//         if (!userData) {
//             return res.status(404).json({ error: 'User not found' });
//         }
//         // If a user is found, send the user data as JSON response
//         res.status(200).json(userData);
//     } catch (error) {
//         console.error('Error fetching user data:', error);
//         res.status(500).json({ error: 'Internal Server Error' });
//     }
// });
 



app.get('/user',async (req, res) => {
    try {
        const id = req.query.id; // Extract the _id from the query parameters
        // Use Mongoose to find a user with the specified _id
        const userData = await usersDb.findOne({ _id: new ObjectId(id) });
        if (!userData) {
            // If no user is found with the provided _id, return a 404 Not Found response
            return res.status(404).json({ error: 'User not found' });
        }
        // If a user is found, send the user data as JSON response
        res.status(200).json(userData);
    } catch (error) {
        console.error('Error fetching data:', error);
        // If an error occurs, return a 500 Internal Server Error response
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
app.get('/userId', verifyToken, async (req, res) => {
    try {
        const id = req.query.id; // Extract the _id from the query parameters
        // Use Mongoose to find a user with the specified _id
        const userData = await usersDb.findOne({ _id: new ObjectId(id) });
        if (!userData) {
            // If no user is found with the provided _id, return a 404 Not Found response
            return res.status(404).json({ error: 'User not found' });
        }
        // If a user is found, send the user data as JSON response
        res.status(200).json(userData);
    } catch (error) {
        console.error('Error fetching data:', error);
        // If an error occurs, return a 500 Internal Server Error response
        res.status(500).json({ error: 'Internal Server Error' });
    }
});




        // Route to register a new user
        app.post('/user', async (req, res) => {
            try {
                const body = req.body;
                const result = await usersDb.insertOne(body)
                res.send(result)
               
            } catch (error) {
                console.error("Error registering user:", error);
                res.status(500).json({ message: "Internal server error" });
            }
        });




        // Route to authenticate user login
        app.post('/login', async (req, res) => {
            try {
                const { email, password } = req.body;
                const user = await usersDb.findOne({ email });
                if (!user) {
                    return res.status(400).json({ message: "Invalid email or password" });
                }
                const passwordMatch = await bcrypt.compare(password, user.password);
                if (!passwordMatch) {
                    return res.status(400).json({ message: "Invalid email or password" });
                }
                const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
                res.status(200).json({ message: "Login successful", user, token });
            } catch (error) {
                console.error("Error logging in:", error);
                res.status(500).json({ message: "Internal server error" });
            }
        });



        // API to create a new comment
        app.post('/comments', async (req, res) => {
            try {
                const comment = req.body;
                const result = await commentsDb.insertOne(comment);
                res.json(result);
            } catch (err) {
                console.error('Error creating comment:', err);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });
        // Express Route for Posting Replies to Comments
        app.post('/comments/:id/replies', async (req, res) => {
            try {
                const { id } = req.params;
                const { text, username, avatar } = req.body;
                const reply = { _id: new ObjectId(), text, username, avatar };

                // Find the comment by ID and push the new reply to its replies array
                const result = await commentsDb.updateOne(
                    { _id: new ObjectId(id) },
                    { $push: { replies: reply } }
                );

                res.json(reply);
            } catch (error) {
                console.error('Error posting reply:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        // API to get all comments
        app.get('/comments', async (req, res) => {
            try {
                const result = await commentsDb.find().toArray();
                res.json(result);
            } catch (err) {
                console.error('Error fetching comments:', err);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });






        app.post('/createProduct', async (req, res) => {
            try {
                const body = req.body;
                const result = await productsDb.insertOne(body)
                res.send(result)
            }
            catch (err) {
                console.log("this error is product add post error", err)
            }
        })



        app.get('/products', async (req, res) => {
            try {
                const cursor = productsDb.find()
                const result = await cursor.toArray()
                res.status(200).json(result);
            }
            catch (error) {
                console.error('Error fetching products:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        })


        app.get('/userCart', async (req, res) => {
            try {
                const cursor = cartsDb.find()
                const result = await cursor.toArray()
                res.status(200).json(result);
            } catch (error) {
                console.error('Error fetching products:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });
        app.get('/search/categories', async (req, res) => {
            try {
                const { category } = req.query;
                if (!category) {
                    return res.status(400).json({ message: "Product category not provided" });
                }

                const products = await productsDb.find({ category: category }).toArray();
                res.status(200).json(products);
            } catch (error) {
                console.error('Error fetching products:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });


        // app.get('/users', async (req, res) => {
        //     try {
        //         const cursor = usersDb.find()
        //         const result = await cursor.toArray()

        //         res.status(200).json(result);
        //     } catch (error) {
        //         console.error("Error fetching user:", error);
        //         res.status(500).json({ message: "Internal server error" });
        //     }
        // });




        app.get('/ordered', async (req, res) => {
            try {
                const transactionId = req.query.transactionId;
                if (!transactionId) {
                    return res.status(400).json({ message: "Transaction ID is required" })
                }
                const ordered = await productOrdersDb.findOne({ transactionId: transactionId })
                if (!ordered) {
                    return res.status(404).json({ message: "Order not found" })
                }
                res.status(200).json(ordered)
            } catch (error) {
                console.error("Error querying ordered:", error);
                res.status(500).json({ message: "Internal server error" })
            }
        })




        app.get('/product/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) }
                const result = await productsDb.findOne(query)
                res.send(result)
            }
            catch (err) {
                console.log("single pproduct get error", err)
            }
        })

        app.get('/buy/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const count = req.query.count; // Extract count from query string
                const query = { _id: new ObjectId(id) };
                const result = await productsDb.findOne(query);
                // Assuming result is an object representing the product details
                // You can now include the count in the response
                res.send({ ...result, count });
            } catch (err) {
                console.log("single product get error", err);
                res.status(500).send("Internal Server Error");
            }
        });



        app.post('/payment/success/:tranId', async (req, res) => {
            console.log(req.params.tranId)
            const result = await productOrdersDb.updateOne(
                { transactionId: req.params.tranId },
                {
                    $set: {
                        paidStatus: true,
                    }
                }
            );
            if (result.modifiedCount > 0) {
                res.redirect(`https://e-commerce-bazar.web.app/payment/success/${req.params.tranId}`)
            }
        });
        
        // Define the payment failure route outside of the '/order' endpoint handler
        app.post('/payment/fail/:tranId', async (req, res) => {
            const result = productOrdersDb.deleteOne(
                { transactionId: req.params.tranId }
            );
        
            if (result.deletedCount) {
                res.redirect(`https://e-commerce-bazar.web.app/payment/fail/${req.params.tranId}`)
            }
        })


        // payment code start hare 

        const tran_id = new ObjectId().toString();


        app.post('/order', async (req, res) => {
            console.log(req.body)

            const product = await productsDb.findOne({ _id: new ObjectId(req.body.productId) })




            const { productId, count, title, category, userName, email, colorsArray, city, address, zipCode } = req.body;

            const totalPrice = product?.price * count;
            const data = {
                total_amount: totalPrice,
                product_count: count,
                currency: 'BDT',
                colors: colorsArray,
                tran_id: tran_id,
                success_url: `https://ecommerce-server-beta.vercel.app/payment/success/${tran_id}`,
                fail_url: `https://ecommerce-server-beta.vercel.app/payment/fail/${tran_id}`,
                cancel_url: 'http://localhost:3030/cancel',
                ipn_url: 'http://localhost:3030/ipn',
                shipping_method: 'Courier',
                product_name: title,
                product_category: category,
                product_profile: 'general',
                cus_name: userName,
                cus_email: email,
                cus_add1: address,
                cus_add2: 'Dhaka',
                cus_city: city,
                cus_state: 'Dhaka',
                cus_postcode: zipCode,
                cus_country: 'Bangladesh',
                cus_phone: '01711111111',
                cus_fax: '01711111111',
                ship_name: 'Customer Name',
                ship_add1: 'Dhaka',
                ship_add2: 'Dhaka',
                ship_city: 'Dhaka',
                ship_state: 'Dhaka',
                ship_postcode: 1000,
                ship_country: 'Bangladesh',
            };
            const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
            sslcz.init(data).then(apiResponse => {
                // Redirect the user to payment gateway
                let GatewayPageURL = apiResponse.GatewayPageURL
                res.send({ url: GatewayPageURL })


                const finalOrder = {
                    userName:userName,
                    email:email,
                    productId:productId,
                    totalPrice:totalPrice,
                    colorsArray:colorsArray,
                    city:city,
                    address:address,
                    zipCode:zipCode,
                    paidStatus: false,
                    transactionId: tran_id,
                }

                const result = productOrdersDb.insertOne(finalOrder)

                console.log('Redirecting to: ', GatewayPageURL)


            });
            console.log(data)

        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('E-commerce  Server Server is running...')
})

app.listen(port, () => {
    console.log(`E-commerce is running on port ${port}`)
})