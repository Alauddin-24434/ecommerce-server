// Import necessary packages
import express from "express"; // Express.js for server
import dotenv from "dotenv"; // dotenv for environment variables
import mongoose from "mongoose"; // Mongoose for MongoDB object modeling
import cors from "cors"
import bcrypt from 'bcryptjs'; // bcryptjs for password hashing
import jwt from 'jsonwebtoken'; // jsonwebtoken for JWT authentication
import { ObjectId, } from 'mongodb'; // ObjectId from MongoDB for generating transaction IDs
import SSLCommerzPayment from "sslcommerz-lts"; // SSLCommerzPayment for handling payments

// Create an Express application
const app = express();
dotenv.config(); // Load environment variables from .env file

// Function to connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO, {
            dbName: "e-commerce-bazar",
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("MongoDB connection error:", error);
        process.exit(1);
    }
};

// Retrieve store credentials and mode from environment variables
const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASS;
const is_live = false; // Set to true for live, false for sandbox

// Define schema for user data
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Create a User model based on the schema
const User = mongoose.model('User', userSchema);

// Define schema for product data
const productSchema = new mongoose.Schema({
    category: { type: String, required: true },
    brand: { type: String, required: true },
    title: { type: String, required: true },
    images: [{ type: String }],
    colors: [{ type: String }],
    price: { type: Number, required: true },
    discount: { type: Number },
    description: { type: String },
    percent: { type: Number },
    rating: [{ type: Number }],
});

// Create a Product model based on the schema
const Product = mongoose.model('Product', productSchema);

// Define schema for order data
const orderSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    totalPrice: {
        type: Number,
        required: true
    },
    userName:{type: String, required: true },
    email:{type: String, required: true},
    paidStatus: {
        type: Boolean,
        default: false
    },
    transactionId: {
        type: String,
        required: true,
        unique: true
    },
    colorsArray: [{ type: String }],
    city: { type: String, required: true },
    address: { type: String, required: true },
    zipCode: { type: String, required: true },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Create an Order model based on the schema
const Order = mongoose.model('Order', orderSchema);

// Log a message when MongoDB connection is disconnected
mongoose.connection.on("disconnected", () => {
    console.log("MongoDB disconnected");
});

// Enable CORS and JSON body parsing middleware
const allowedOrigin = 'http://localhost:5173';

// CORS middleware configuration
const corsOptions = {
    origin: allowedOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
    allowedHeaders: 'Content-Type,Authorization',
};

// Enable CORS middleware
app.use(cors(corsOptions));
app.use(express.json());

// Middleware to verify JWT token
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

// Route to register a new user
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: "User created successfully" });
    } catch (error) {
        console.error("Error registering user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Route to create a new product
app.post('/createProduct', async (req, res) => {
    try {
        const productData = req.body;
        const newProduct = await Product.create(productData);
        res.status(201).json(newProduct);
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Route to fetch all products
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find();
        res.status(200).json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/search/categories', async (req, res) => {
    try {
        const categories=req.query.categories;
        if(!categories){
            return res.status(400).json({message:"Product Not found"})
        }

        const products = await Product.find({categories});
        res.status(200).json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/userId',verifyToken, async (req, res) => {
    try {
      const _id = req.query._id; // Extract the _id from the query parameters
      // Use Mongoose to find a user with the specified _id
      const userData = await User.findOne({_id});
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
  

app.get('/api/categories', async (req, res) => {
    try {
        const categories = await Product.aggregate([
            {
                $group: {
                    _id: "$category", // Group by category field
                }
            },
            {
                $project: {
                    _id: 0, // Exclude the _id field from the result
                    category: "$_id", // Rename _id as category
                }
            }
        ]);

        // Extract only the category names from the categories array
        let categoryNames = categories.map(category => category.category);

        // Sort the category names in a specific order
        categoryNames.sort(); // Example: Sort alphabetically

        res.status(200).json(categoryNames);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});




// Route to fetch a specific product by ID
app.get('/api/product/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const product = await Product.findOne({ _id: id });
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.status(200).json(product);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Route to prepare data for purchasing a product
app.get('/api/buy/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const count = req.query.count; // Extract count from query string
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.status(200).json({ ...product.toObject(), count });
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Route to authenticate user login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
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

// Route to fetch user profile
app.get('/api/user', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json(user);
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get('/api/ordered', async (req, res) => {
    try {
        const transactionId = req.query.transactionId;
        if (!transactionId) {
            return res.status(400).json({ message: "Transaction ID is required" })
        }
        const ordered = await Order.findOne({transactionId})
        if(!ordered){
            return res.status(404).json({message: "Order not found"})
        }
        res.status(200).json(ordered)
    } catch (error) {
        console.error("Error querying ordered:", error);
        res.status(500).json({ message: "Internal server error" })
    }
})

// Route to create a new order
app.post('/api/order', async (req, res) => {
    try {
        const { productId, count, title, category, userName, email, colorsArray, city, address, zipCode } = req.body;

        // Find the product by ID
        const product = await Product.findById(productId);

        // If product not found, return error
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Calculate total price
        const totalPrice = product.price * count;

        // Generate a transaction ID
        const tran_id = new ObjectId().toString();

        // Prepare data for SSLCommerz payment
        const data = {
            total_amount: totalPrice,
            product_count: count,
            currency: 'BDT',
            colors: colorsArray,
            tran_id: tran_id,
            success_url: `http://localhost:5000/payment/success/${tran_id}`,
            fail_url: `http://localhost:5000/payment/fail/${tran_id}`,
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

        // Initialize SSLCommerz payment
        const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);

        // Initiate payment and get GatewayPageURL
        sslcz.init(data).then(apiResponse => {
            let GatewayPageURL = apiResponse.GatewayPageURL;
            res.send({ url: GatewayPageURL });

            // Create a new order object
            const finalOrder = new Order({
                userName,
                email,
                productId,
                totalPrice,
                colorsArray,
                city,
                address,
                zipCode,
                paidStatus: false,
                transactionId: tran_id,
            });

            // Save the order to the database
            finalOrder.save().then(savedOrder => {
                console.log('Order saved:', savedOrder);
            }).catch(error => {
                console.error('Error saving order:', error);
            });

        }).catch(error => {
            console.error('Error initializing payment:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        });

    } catch (error) {
        console.error('Error processing order:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Route to handle successful payment
app.post('/payment/success/:tranId', async (req, res) => {
    try {
        const tranId = req.params.tranId;

        // Find and update the order status to paid
        const updatedOrder = await Order.findOneAndUpdate(
            { transactionId: tranId },
            { paidStatus: true },
            { new: true }
        );

        // If order not found, return error
        if (!updatedOrder) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Redirect to success page
        res.redirect(`http://localhost:5173/payment/success/${tranId}`);
    } catch (error) {
        console.error('Error processing successful payment:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Route to handle failed payment
app.post('/payment/fail/:tranId', async (req, res) => {
    try {
        const tranId = req.params.tranId;

        // Find and delete the order
        const deletedOrder = await Order.findOneAndDelete({ transactionId: tranId });

        // If order not found, return error
        if (!deletedOrder) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Redirect to fail page
        res.redirect(`http://localhost:5173/payment/fail/${tranId}`);
    } catch (error) {
        console.error('Error processing failed payment:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    const errorStatus = err.status || 500;
    const errorMessage = err.message || "Something went wrong!";
    if (process.env.NODE_ENV === "production") {
        return res.status(errorStatus).json({
            success: false,
            status: errorMessage,
            message: errorMessage,
        });
    } else {
        return res.status(errorStatus).json({
            success: false,
            status: errorStatus,
            message: errorMessage,
            stack: err.stack
        });
    }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    connectDB(); // Connect to MongoDB
    console.log(`Server is running on port ${PORT}`);
});
