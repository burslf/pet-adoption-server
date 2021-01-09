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
const { stat } = require("fs");
const {Storage} = require('@google-cloud/storage');
const { format } = require("path");

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

// Define Google storage 
const gc = new Storage({
  keyFilename: path.join(__dirname, "./public/pet-adoption-300714-9d6b887fd9b7.json"),
  projectId: "pet-adoption-300714"
})
const petAdoptionBucket = gc.bucket('pet-adoption')

// Multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 2048 * 2048
  }
})

// Get users
app.get("/users", authenticateToken, (req, res) => {
  User.find({}, (err, doc) => {
    res.send(doc);
  });
});

// Edit user profile
app.post("/user/:id", (req, res) => {
  User.findOne({_id: req.params.id}, async (err, doc) => {
    if(req.body.firstname == doc.firstname && req.body.lastname == doc.lastname && req.body.phone == doc.phone && req.body.bio == doc.bio) {
      res.status(209).send("No changes has been made.")
      return
    }
    doc.firstname = req.body.firstname
    doc.lastname = req.body.lastname
    doc.phone = req.body.phone
    doc.firstname = req.body.firstname
    doc.bio = req.body.bio
    await doc.save()
    res.send("Edited with success.")
  })
})

// Edit user password
app.post("/user/:id/password", async (req, res) => {
  if (req.body.password.length == 0 && req.body.confirmPassword.length ==0) {
    res.status(409).send("Password can't be empty.")
    return
  } 
  if(req.body.password == req.body.confirmPassword) {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    User.findOne({_id: req.params.id}, async (err, doc) => {
      doc.password = hashedPassword
      await doc.save()
      res.send("Password changed succesfully.")
    })
  } else {
    res.status(409).send("Passwords don't match.")
  }
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
      if(req.body.password == req.body.confirmPassword) {
      user.save().then((result) => res.send(result));
      } else {
        res.status(409).send("passwords don't match")
      }
    } else {
        res.status(409).send("email already exists");
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
            res.send({accessToken, id: doc[0]._id, isAdmin: user.isAdmin})
        } else {
            res.sendStatus(403)
        }
      }
    }
  );
});

// Add new pet (only admin)
app.post("/pet", upload.single('file'), async (req, res, next) => {
  const decoded = jwt.decode(req.body.isAdmin);
  console.log(decoded)
  console.log(req.body['name'])
  if(decoded.isAdmin) {
  if(!req.file) {
    res.status(400).send('No file uploaded')
  }
  const blob = petAdoptionBucket.file(req.file.originalname)
  const blobStream = blob.createWriteStream()
  blobStream.on('error', err => {
    next(err)
  })

  blobStream.on('finish', () => {
    // The public URL can be used to directly access the file via HTTP.
    const publicUrl = `https://storage.googleapis.com/${petAdoptionBucket.name}/${blob.name}`
    res.status(200).send(publicUrl);
  });

  blobStream.end(req.file.buffer)
const crocoName = ['Ali', 'Gator']
  for(let i=0; i<crocoName.length; i++) {
    const pet = new Pet(req.body)
    console.log(pet.keywords)
    await pet.save().then(result => res.send(result))
    pet.name = crocoName[i]
    pet.keywords.push({
      name: getKeywords(req.body['name']),
    })
    pet.picture = `https://storage.googleapis.com/${petAdoptionBucket.name}/${blob.name}`
    await pet.save().then(result => res.send(result))
  }

  } else {
    res.status(403).send('Not admin')
  }
})

// Delete pet(req.body.data)
app.post('/delete/:id', (req, res) => {
  Pet.find({_id: req.params.id}, (err, doc) => {
  }).deleteOne(() => res.send(`${req.params.id} is deleted`))
})
app.get('/deletepet', (req, res) => {
  res.send('hello')
})

// Get all pets
app.get('/pets', (req, res) => {
  Pet.find({}, (err, doc) => {
    res.json(doc)
  })
})

// Advanced query pet
app.get("/pet/advanced-search", (req,res) => {
  const name = req.query.name
  const status = req.query.status
  const type = req.query.type
  const minHeight = req.query.minHeight
  const maxHeight = req.query.maxHeight
  
  const response = []

  Pet.find({$and: [{name: name}, {type: type}]}, async (err,doc) => {
    if (doc.length == 0) {
      await Pet.find({$and: [{type: type}, {status: status}]}, (err, type) => {
        res.json(type)
      })
    } else {
      doc.forEach(async pet => {
        if((pet.height >= minHeight && pet.height <= maxHeight) && pet.status == status) {
          await response.push(pet)
        }
      })
      response.length > 0 ? res.json(response) : res.json({sorry: "no result found"})
    }
  })
})

// Basic query pet
app.get('/pet/basic-search', (req,res) => {
  const type = req.query.type
  const name = req.query.name

  Pet.find({$and: [{type: type}, {name: name}]}, (err, doc) => {
    if(doc.length == 0) {
      Pet.find({type: type}, (err, type) => {
        res.json(type)
      })
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
      res.json(doc)
    }) 
  } else {
    res.send("Not admin")
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


function getKeywords (str) {
  var i,
    j,
    result = [];
  for (i = 0; i < str.length; i++) {
    for (j = i + 1; j < str.length + 1; j++) {
      result.push(str.slice(i, j).toLowerCase());
    }
  }
  return result;
};
