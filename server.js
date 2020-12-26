require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const multer = require("multer");
const path = require("path");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const User = require("./userModel.js");
const Pet = require("./petModel");

// Init MongoDB database
const dbURI =
  "mongodb+srv://burslf:Enferoumonde666@cluster0.fbsf6.mongodb.net/pet-adoption?retryWrites=true&w=majority";
mongoose
  .connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("connected to MongoDB"))
  .catch((err) => console.error(err));

// Init Express
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Get users
app.get("/users", authenticateToken, (req, res) => {
  User.find({}, (err, doc) => {
    res.send(doc);
  });
});

// Edit user profile
app.post("/user/:id", (req, res) => {
  User.findOne({_id: req.params.id}, async (err, doc) => {
    doc.firstname = req.body.firstname
    doc.lastname = req.body.lastname
    doc.phone = req.body.phone
    doc.firstname = req.body.firstname
    doc.bio = req.body.bio
    await doc.save()
  })
})

// Get user by id
app.get("/user/:id", authenticateToken, (req, res) => {
  User.findOne({_id: req.params.id}, (err, doc) => {
    res.send(doc);
  });
});

// Sign up new user
app.post("/signup", async (req, res) => {
  const hashedPassword = await bcrypt.hash(req.body.password, 10);
  console.log(req.body)
  const user = new User({
    firstname: req.body.firstname,
    lastname: req.body.lastname,
    email: req.body.email,
    phone: req.body.phone,
    password: hashedPassword,
    isAdmin: false
  });

  User.find({ email: req.body.email }, (err, doc) => {
    if (doc.length == 0) {
      user.save().then((result) => res.send(result));
    } else {
      res.send("email already exists");
    }
  });
});

// Login user
app.post("/login", (req, res) => {
  User.find(
    { email: req.body.email },
    async (err, doc) => {
      if (doc.length == 0) {
        res.status(444).send("something went wrong");
      } else {
        if (await bcrypt.compare(req.body.password, doc[0].password)) {
            const user = { email: req.body.email, isAdmin: doc[0].isAdmin };
            const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET);
            res.send({accessToken, id: doc[0]._id})
        } else {
            res.sendStatus(403)
        }
      }
    }
  );
});

// Add new pet (only admin)
app.post("/pet", async (req, res) => {
  // you herepets
  const decoded = jwt.decode(req.body.isAdmin);
  console.log(decoded)
  if(decoded.isAdmin) {
    const pet = new Pet(req.body.data)
    await pet.save().then(result => res.send(result))
  } else {
    res.status(403).send('Not admin')
  }
})

// Get pet + query pet
app.get("/pet", (req,res) => {
  const name = req.query.name
  const adopted = req.query.adopted
  const type = req.query.type
  const height = req.query.height
  const weight = req.query.weight

  Pet.find({$or: [{name: name}, {type:type}, {height:height}, {weight: weight}]}, (err, doc) => {
    if(doc.length == 0) 
    {
      Pet.find({}, (err,doc) => res.json(doc))
    } else { 
      res.json(doc)
    }
    })
  
})

// Get pet by id
app.get("/pet/:id", (req, res) => {
  Pet.find({_id: req.params.id}, (err, doc) => {
    res.json(doc)
  })
})

//Save pet
app.post("/pet/:id/save", (req,res) => {
  if(req.body.userId) {
    const petId = req.params.id
    Pet.findOne({_id: req.params.id}, async (err, pet) => {
      User.findOne({_id: req.body.userId}, async (err, doc) => {
        console.log(doc.saved[0])
          if(!doc.saved.some(e => e._id == petId)) {
            doc.saved.push(pet)
            await doc.save()  
            res.send('saved')
          }
      })
    })
  } else {
    res.status(403).send('Not logged')
  }
})
// Unsave pet 
app.post("/pet/:id/unsave", (req, res) => {
  if(req.body.userId) {
    const petId = req.params.id
    User.findOne({_id: req.body.userId}, async (err, doc) => {
      const newArray = doc.saved.filter(a => a['_id'] != petId)
      doc.saved = newArray
      await doc.save()
      res.send('unsaved')
  })
  }
})

// Adopt/Foster a pet
app.post("/pet/:id/adopt", (req,res) => {
  const petId = req.params.id
  if(req.body.userId) {
  Pet.findOne({_id: petId}, async (err, pet) => {
    pet.status = req.body.status
    pet.owner = req.body.userId
    await pet.save()
    await User.findOne({_id: req.body.userId}, async (err, doc) => {
      if (doc.owns.some(a => a._id == petId)) {
        console.log('already exist')
      } else {
        doc.owns.push(pet)
        await doc.save()
      }
    })
  })
  res.json({"newStatus":req.body.status})
  } else {
    res.status(403).send('Not logged')
  }
})

app.post("/pet/:id/foster", (req,res) => {
  const petId = req.params.id
  console.log(req.body.userId)
  if(req.body.userId) {
    Pet.findOne({_id: petId}, async (err, pet) => {
      pet.status = req.body.status
      pet.owner = req.body.userId
      await pet.save()
      User.findOne({_id: req.body.userId}, async (err, doc) => {
        if (doc.owns.petId) {
          console.log('already exist')
        } else {
          doc.owns.push(pet)
          await doc.save()
        }
      })
    })
    res.json({"newStatus":req.body.status})
  }

})

// Return pet 
app.post("/pet/:id/return", (req,res) => {
  console.log("req.params.id: " + req.params.id)
  const newStatus = "Available"
  Pet.findOne({_id: req.params.id}, async (err, doc) => {
    doc.status = newStatus
    doc.owner = ''
    await doc.save()
    await User.findOne({_id: req.body.userId}, async (err, doc) => {
      const newArray = doc.owns.filter(a => a._id != req.params.id)
      console.log(newArray)
      doc.owns = newArray
      await doc.save()
  })
  })

  res.json({"newStatus":newStatus})
})

// Edit pet
app.put("/pet/:id", (req, res) => {
  const decoded = jwt.decode(req.body.isAdmin)
  if(decoded && decoded.isAdmin) {
    Pet.findOne({_id: req.params.id}, async (err, doc) => {
      for(let title in req.body.data) {
        doc[title] = req.body.data[title]
        await doc.save()
      } 
      console.log(doc)
      res.json(doc)
    }) 
  } else {
    res.json({error: "Not admin"})
  }
})


function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token === null) return res.sendStatus(401);
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return res.status(403).send('You are not admin');
    req.user = user;
    next();
  });
}

app.listen(port, () => {
  console.log("listening...");
});