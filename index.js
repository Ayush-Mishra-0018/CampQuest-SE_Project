require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const Joi = require("joi");
const path = require("path");
const app = express();
const ejsMate = require("ejs-mate");
const methodOverride = require("method-override");
const bcrypt = require("bcrypt");
const session = require("express-session");
const ExpressError = require("./helper/ExpressError");
const campgroundRoute = require("./Routers/campground");
const reviewRoute = require("./Routers/review");
const passport = require("passport");
const localpassport = require("passport-local");
const User = require("./Models/User");
const userRouter = require("./Routers/user");

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("DATABASE IS SETUP ✅");
  } catch (e) {
    console.log("❌ Database Connection Failed:", e.message);
  }
})();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static("public"));

const sessionConfig = {
  secret: "SecretMessage",
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
};

app.use(session(sessionConfig));
const flash = require("connect-flash");
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new localpassport(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  const isStaticAsset =
    req.originalUrl.startsWith("/css") ||
    req.originalUrl.startsWith("/js") ||
    req.originalUrl.startsWith("/images") ||
    req.originalUrl.startsWith("/favicon.ico");
  if (
    req.method === "GET" &&
    !req.originalUrl.includes("/login") &&
    !req.originalUrl.includes("/register") &&
    !req.originalUrl.includes("/logout") &&
    !isStaticAsset
  ) {
    req.session.returnTo = req.originalUrl;
  }
  next();
});
app.use((req, res, next) => {
  res.locals.result = req.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

app.use("/campgrounds", campgroundRoute);
app.use("/campgrounds/:id/review", reviewRoute);
app.use("/", userRouter);

// Root route - redirect to login
app.get("/", (req, res) => {
  res.redirect("/login");
});

app.all("*", (req, res, next) => {
  next(new ExpressError("Page Not Found", 404));
});
app.use((err, req, res, next) => {
  let { status = 404, message = "IDK WHAT HAPPENED" } = err;
  res.status(status).render("errors", { message, err });
});

app.listen(3000, () => {
  console.log("SERVER IS SET UP ✅");
});
