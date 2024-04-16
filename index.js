import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import fs from "fs";
import session from 'express-session';
import pg from "pg";
import pool from './pool.js';





const app = express();
const port = process.env.PORT || 3000;




app.use(session({
  secret: 'your-secret-key', // Chiave segreta per firmare il cookie della sessione
  resave: false, // Evita il salvataggio della sessione se non viene modificata
  saveUninitialized: false, // Evita di salvare sessioni non inizializzate
  cookie: {
    secure: false, // Imposta il cookie di sessione su secure solo se usi HTTPS
    httpOnly: false // Impedisce l'accesso al cookie di sessione da JavaScript lato client
  }
}));
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));



let town_to_guess = "";
let random_province = "";
let provinces = [];
let number_of_answers = 3;
let benvenuto = "Benvenuto! In questo gioco dovrai indovinare a quale provincia appartiene il Comune italiano che ti verrà mostrato di volta in volta!"
let message = "Let's guess the province of this town:";
var score = 0;

var guestName = "Your";
var userIndex = 0;
let loggedIn = false;
var userRecord = 0;
let users = []

// Funzione per verificare lo stato di login dell'utente
function checkLoggedIn(req, res) {
  if (!loggedIn) {
    // Se l'utente non è loggato, reindirizzalo alla pagina di login
    res.render("index.ejs", { benvenuto: "Effettua il login per giocare!" });
    return false;
  }
  return true;
}


function shuffleArray(array) {
  let len = array.length,
      currentIndex;
  for (currentIndex = len - 1; currentIndex > 0; currentIndex--) {
      let randIndex = Math.floor(Math.random() * (currentIndex + 1) );
      var temp = array[currentIndex];
      array[currentIndex] = array[randIndex];
      array[randIndex] = temp;
  }
  return array;
}



async function buildProvinces(){
  
  try {
    
                //get the italian provinces' list
    const response = await axios.get("https://axqvoqvbfjpaamphztgd.functions.supabase.co/province");
    const result = response.data;
                //get a random province and push it in the array
    random_province = result[(Math.floor(Math.random() * result.length))].nome;
    provinces.push(random_province);
    //git1
                //get 9 more random provinces and push them in the array
    while(provinces.length<number_of_answers){
      let temp_prov = result[(Math.floor(Math.random() * result.length))].nome;
      if (!provinces.includes(temp_prov)){
        provinces.push(temp_prov)
      }
    
    }
    console.log("Province to guess: "+random_province);
    //console.log("Province array: "+provinces);
              
    //now you have to shuffle the array items
    provinces = shuffleArray(provinces);
    //console.log("Shuffled Province array: "+provinces);

  } catch (error) {
    console.error("Failed to make request:", error.message);
    res.render("game.ejs", {      error: error.message,    });  
  }

}

async function showGame(res){
  try{
    
    //guestName=guestName;
    //get the comunis' list
    const town_response = await axios.get(`https://axqvoqvbfjpaamphztgd.functions.supabase.co/comuni/provincia/${random_province}`);
    const towns_result = town_response.data;
    //get the comune to guess
    town_to_guess = towns_result[(Math.floor(Math.random() * towns_result.length))].nome;
    //console.log("Comune: "+town_to_guess);
    res.render("game.ejs", { message:message, town_to_guess: town_to_guess, provinces: provinces, score: score, guestName: guestName, record: userRecord });
    
    provinces=[];

    }catch (error) {
      console.error("Failed to make request:", error.message);
      res.render("game.ejs", {      error: error.message,    });  
    }

}

/*
async function readDb(){
  
  const data = fs.readFileSync(dbName, "utf-8");
  users= JSON.parse(data);
  console.log("users[0].name in readDb func: "+users[0].name)

}
*/


app.get("/", async (req, res) => {
  benvenuto = "Benvenuto! In questo gioco dovrai indovinare a quale provincia appartiene il Comune italiano che ti verrà mostrato di volta in volta!"
  //await readDb();
  res.render("index.ejs",{benvenuto: benvenuto})
  
});



/*
function checkLogin(name, pw){
   db.query("SELECT * FROM users WHERE userid = $1 AND pwhash = $2;", [name, pw], (err, res) => {
    
    if (err) {
      console.error("Error executing query", err.stack);
    }else{
      if(res.rows.length>0){
      console.log("Login corretto. Benvenuto, "+res.rows[0].userid);
      guestName = name;
      loggedIn= true;
      console.log(loggedIn);
      
    } else{
      benvenuto="Wrong Nickname or password! Did you already registered?";
      console.log("Nickname o password errati. Ti sei già registrato?");
      loggedIn= false;}}
    db.end();
  });
}

*/
async function checkLogin(name, pw) {
  try {
    
    const db = await pool.connect();
    const res = await db.query("SELECT * FROM users WHERE userid = $1 AND pwhash = $2;", [name, pw]);
    db.release();
    if (res.rows.length > 0) {
      console.log("Login corretto. Benvenuto, " + res.rows[0].userid);
      guestName = name;
      userRecord = res.rows[0].record;
      loggedIn = true;
    } else {
      benvenuto = "Wrong Nickname or password! Did you already registered?";
      console.log("Nickname o password errati. Ti sei già registrato?");
      loggedIn = false;
    }
    return loggedIn;
  } catch (err) {
    console.error("Error executing query", err.stack);
    throw err;
  }
}


app.post("/login", async (req, res) =>{
  try {
    score = 0;
    //console.log(number_of_answers);
    
    if(req.body.provinces){number_of_answers= req.body.provinces;}

    //console.log("196: req.body: "+req.body.nickname+", "+req.body.password)
    if(req.body.logIn_button){
      //console.log("login button pressed!");
      loggedIn = await checkLogin(req.body.nickname, req.body.password);
      if(!loggedIn){
        res.render("index.ejs", {benvenuto: benvenuto})
        console.log(loggedIn);
      }else{
            req.session.user = {
              nickname: req.body.nickname,
              score: score,
              record: userRecord
            };
            console.log(req.session.user);
            await buildProvinces();
            showGame(res);};
    }else if(req.body.guest_button){
      userRecord = 0;

      if (req.body.guestName){
          guestName=req.body.guestName
          };
          await buildProvinces();
          showGame(res);
  }
    
  } catch (error) {
    console.error("Error handling login", error);
    res.status(500).send("Internal Server Error"); 
  }



  
 
  console.log("req.body.provinces: "+req.body.provinces);
});



app.post("/create_account", async (req, res) =>{
  score = 0;
  console.log(req.body);
  res.render("createAccount.ejs");
  
});


/*
function writeDbNewUser(obj, dbName="./db/users.json"){

  if (!obj){return console.log("Please provide data to save")};
  
  try {
    fs.writeFileSync(dbName, JSON.stringify(users));

    return console.log("Save succefull");
    
  } catch (error) {
    return console.log("Save failed");
    
  }
}
*/

app.post("/inserted_newAcc", async (req, res) =>{
  let newUser ={};
  //const checkName = (n) => n.name===req.body.nickname;
  const db = await pool.connect();
  const response = await db.query("SELECT * FROM users WHERE userid = $1;", [req.body.nickname]);
  if (response.rows.length > 0){
    res.render("riprova.ejs", {riprova: "Il nickname scelto risulta già in uso!"});
  }else if(req.body.nickname && req.body.password){
      newUser = {
            name: req.body.nickname,
            pw: req.body.password,
            record: 0,  
    }
    console.log()
    await db.query("INSERT INTO users (userid, pwhash, record) VALUES($1, $2, $3);", [newUser.name, newUser.pw, newUser.record]);
      db.release();
      score = 0;
      console.log("req.body nick e pw: "+req.body.nickname+" "+req.body.password+" - users: "+users);
      //await readDb();
      res.render("account_confirmed.ejs", {benvenuto: benvenuto})
  } else{
    res.render("riprova.ejs", {riprova: "Per favore, inserisci anche una password!"});
  }
});


app.post("/newgame", async (req, res) =>{
  console.log(req.body);
  console.log("guestName " + guestName +" - score " + score +" - logged " + loggedIn +" - userRecord " + userRecord);
  score = 0;
  
  message="Let's guess the province of this town:";
  if(req.body.provinces){
    number_of_answers= req.body.provinces;
  }else{
    number_of_answers=number_of_answers;
  }
  console.log("req.body.provinces: "+req.body.provinces);

  // Verifica se l'utente è loggato e se ci sono dati della partita nella sessione
  if (req.session.user) {
    // Recupera le informazioni dell'utente e avvia il gioco
    const { nickname, record } = req.session.user;
    guestName = nickname;
    userRecord = record;
    await buildProvinces();
    showGame(res);
    
  }else {
    // Se l'utente non è loggato o non ci sono dati della partita nella sessione, reindirizza l'utente alla pagina di login
    //res.render("index.ejs", { benvenuto: "Effettua il login per giocare!" });
    await buildProvinces();
    showGame(res);
  }
  
});


app.post("/play_again", async (req, res) =>{

  await buildProvinces();
  showGame(res);
  
  
});



app.post("/submit", async (req, res) =>{
    
    const userAnswer = req.body;  
    //console.log("userAnswer.button: "+userAnswer.button);
    //console.log(req.session.user);
    
    //https://javascript.plainenglish.io/javascript-remove-all-whitespace-from-string-ece685d0ec33

    //sessione di gioco di utente loggato
    if(loggedIn){
      if(userAnswer.button.replace(/\s/g, "")===random_province.replace(/\s/g, "")){
        score++;
        if(score>userRecord){
          userRecord=score, 
          req.session.user.record=score;
          
        };
  
        message = "Correct! The province of "+town_to_guess+" is "+random_province+"! Let's try with the next one!";
        console.log(message);
        await buildProvinces();
        showGame(res);
        
      }else{
        await updateDb();
        score=0;
        message = "Oh, no! The province of "+town_to_guess+" was "+random_province+"! Wanna play again?";
        //console.log(message);
        res.render("game_again.ejs", { message:message, town_to_guess: town_to_guess, provinces: provinces, score: score, guestName: guestName, record: userRecord});
        message = "Let's guess the province of this town:";
        //console.log("guestName " + guestName +" - score " + score +" - logged " + loggedIn +" - userRecord " + userRecord);
        //console.log(req.session.user);
        
      }
  
    //sessione di gioco di utente NON loggato
    }else{
      if(userAnswer.button.replace(/\s/g, "")===random_province.replace(/\s/g, "")){
        score++;
        if(score>userRecord){
          userRecord=score
        };
  
        message = "Correct! The province of "+town_to_guess+" is "+random_province+"! Let's try with the next one!";
        console.log(message);
        await buildProvinces();
        showGame(res);
        
      }else{
        if(score>userRecord){userRecord=score};
        message = "Oh, no! The province of "+town_to_guess+" was "+random_province+"! Wanna play again?";
        score=0;
        //console.log(message);
        res.render("game_again.ejs", { message:message, town_to_guess: town_to_guess, provinces: provinces, score: score, guestName: guestName, record: userRecord});
        message = "Let's guess the province of this town:";
        //console.log("guestName " + guestName +" - score " + score +" - logged " + loggedIn +" - userRecord " + userRecord);
        //console.log("Guest req session user: "+ req.session.user);
      }
    }
    
    


});


/*function writeDb_Logout(obj, dbName="./db/users.json"){

  if (!obj){return console.log("Please provide data to save")};
  
  try {
    fs.writeFileSync(dbName, JSON.stringify(users));

    return console.log("Save succefull")
    
  } catch (error) {
    return console.log("Save failed")
    
  }
}
*/

async function updateDb(){
  const db = await pool.connect();
  await db.query("UPDATE users SET record = $1 WHERE userid= $2;", [userRecord, guestName]);
  db.release(); 
}


app.get("/logout", async (req, res) =>{
  console.log(userRecord, guestName)
  await updateDb();
  
  //console.log(users);
  //writeDb_Logout(users);
  req.session.destroy();
  benvenuto = "Benvenuto! In questo gioco dovrai indovinare a quale provincia appartiene il Comune italiano che ti verrà mostrato di volta in volta!"
  //res.render("index.ejs",{benvenuto: benvenuto})
  //await readDb();
  res.redirect("/");
});




app.listen(port, () => {
  console.log(`Server running on port: ${port}`);
});