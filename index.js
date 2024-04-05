import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import fs from "fs";
import session from 'express-session';


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

//build_provinces(provinces_basket);    

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
    console.log("Province array: "+provinces);
              
    //now you have to shuffle the array items
    provinces = shuffleArray(provinces);
    console.log("Shuffled Province array: "+provinces);

  } catch (error) {
    console.error("Failed to make request:", error.message);
    res.render("game.ejs", {      error: error.message,    });  
  }

}

async function showGame(res){
  try{
    
    guestName=guestName;
    //get the comunis' list
    const town_response = await axios.get(`https://axqvoqvbfjpaamphztgd.functions.supabase.co/comuni/provincia/${random_province}`);
    const towns_result = town_response.data;
    //get the comune to guess
    town_to_guess = towns_result[(Math.floor(Math.random() * towns_result.length))].nome;
    console.log("Comune: "+town_to_guess);
    res.render("game.ejs", { message:message, town_to_guess: town_to_guess, provinces: provinces, score: score, guestName: guestName, record: userRecord });
    
    provinces=[];

    }catch (error) {
      console.error("Failed to make request:", error.message);
      res.render("game.ejs", {      error: error.message,    });  
    }

}


app.get("/", async (req, res) => {
  benvenuto = "Benvenuto! In questo gioco dovrai indovinare a quale provincia appartiene il Comune italiano che ti verrà mostrato di volta in volta!"
  await readDb();
  res.render("index.ejs",{benvenuto: benvenuto})
  
});

async function readDb(dbName="./db/users.json"){
  const data = fs.readFileSync(dbName, "utf-8");
  users= JSON.parse(data);
  console.log("users[0].name in readDb func: "+users[0].name)

}


function checkJsonUser(name, pw){
  const checkName = (n) => n.name===name;
  console.log("users.some: "+ users.some(checkName));
  if(users.some(checkName)){
    const findUserIndex = (e) => e.name===name;
    console.log("users.findIndex: "+users.findIndex(findUserIndex));
    userIndex = users.findIndex(findUserIndex);
    if(users[userIndex].pw===pw){
      guestName=name;
      userRecord=users[userIndex].record;
      console.log("userRecord: "+userRecord);
      return loggedIn=true;
      
    }else{
      benvenuto="Wrong Nickname or password! Did you already registered?";
      return loggedIn=false;
    }

  }else{
    benvenuto="Wrong Nickname or password! Did you already registered?";
    return loggedIn=false;
  }
  

}



app.post("/login", async (req, res) =>{
  score = 0;
  console.log(number_of_answers);
  if(req.body.provinces){
    number_of_answers= req.body.provinces;
  }

  console.log("req.body: "+req.body.nickname+", "+req.body.password)
  
  if(req.body.logIn_button){
  const loggedIn = checkJsonUser(req.body.nickname, req.body.password);
    if(!loggedIn){
      res.render("index.ejs", {benvenuto: benvenuto})
      console.log("benvenuto: "+benvenuto);
      }else{
        req.session.user = {
          nickname: req.body.nickname,
          score: score,
          record: userRecord
        };
        console.log(req.session.user);
        buildProvinces();
        setTimeout(() => {showGame(res)}, "500");
    };
  }else if(req.body.guest_button){
    if (req.body.guestName){
      guestName=req.body.guestName
    };
    buildProvinces();
    setTimeout(() => {showGame(res)}, "500");
    
  }
 
  console.log("req.body.provinces: "+req.body.provinces);
});



app.post("/create_account", async (req, res) =>{
  score = 0;
  console.log(req.body);
  res.render("createAccount.ejs");
  
});


function writeDbNewUser(obj, dbName="./db/users.json"){

  if (!obj){return console.log("Please provide data to save")};
  
  try {
    fs.writeFileSync(dbName, JSON.stringify(users));

    return console.log("Save succefull")
    
  } catch (error) {
    return console.log("Save failed")
    
  }
}

app.post("/inserted_newAcc", async (req, res) =>{
  let newUser ={};
  const checkName = (n) => n.name===req.body.nickname;
  console.log("users.some: "+ users.some(checkName));
  if(users.some(checkName)){
    res.render("riprova.ejs");

  }else if(req.body.nickname && req.body.password){
      newUser = {
            id : users.length+1,
            name: req.body.nickname,
            pw: req.body.password,
            record: 0,  
    }
      users.push(newUser);

      writeDbNewUser(users);
  
      score = 0;
      console.log("req.body nick e pw: "+req.body.nickname+" "+req.body.password+" - users: "+users);
      await readDb();
      res.render("account_confirmed.ejs", {benvenuto: benvenuto})

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
    buildProvinces();
    setTimeout(() => { showGame(res) }, "500");
    
  }else {
    // Se l'utente non è loggato o non ci sono dati della partita nella sessione, reindirizza l'utente alla pagina di login
    //res.render("index.ejs", { benvenuto: "Effettua il login per giocare!" });
    buildProvinces();
    setTimeout(() => { showGame(res) }, "500");
  }
  
});



app.post("/submit", (req, res) =>{
  const userAnswer = req.body;  
    console.log("userAnswer.button: "+userAnswer.button);
    console.log(req.session.user);
    
    //https://javascript.plainenglish.io/javascript-remove-all-whitespace-from-string-ece685d0ec33

    //sessione di gioco di utente loggato
    if(loggedIn){
      if(userAnswer.button.replace(/\s/g, "")===random_province.replace(/\s/g, "")){
        score++;
        if(score>userRecord){
          userRecord=score, 
          req.session.user.record=score;
          users[userIndex].record = userRecord;
        };
  
        message = "Correct! The province of "+town_to_guess+" is "+random_province+"! Let's try with the next one!";
        console.log(message);
        buildProvinces();
        setTimeout(() => {showGame(res)}, "500");
        
      }else{
        if(score>userRecord){userRecord=score; req.session.user.record=score;};
        users[userIndex].record = userRecord;
        message = "Oh, no! The province of "+town_to_guess+" was "+random_province+"! Choose the difficult level and try again!";
        console.log(message);
        res.render("game.ejs", { message:message, town_to_guess: town_to_guess, provinces: provinces, score: score, guestName: guestName, record: userRecord});
        message = "Let's guess the province of this town:";
        console.log("guestName " + guestName +" - score " + score +" - logged " + loggedIn +" - userRecord " + userRecord);
        console.log(req.session.user);
        
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
        buildProvinces();
        setTimeout(() => {showGame(res)}, "500");
        
      }else{
        if(score>userRecord){userRecord=score};
        message = "Oh, no! The province of "+town_to_guess+" was "+random_province+"! Choose the difficult level and try again!";
        console.log(message);
        res.render("game.ejs", { message:message, town_to_guess: town_to_guess, provinces: provinces, score: score, guestName: guestName, record: userRecord});
        message = "Let's guess the province of this town:";
        console.log("guestName " + guestName +" - score " + score +" - logged " + loggedIn +" - userRecord " + userRecord);
        console.log("Guest req session user: "+ req.session.user);
        
      }
  
    }
    
    


});


function writeDb_Logout(obj, dbName="./db/users.json"){

  if (!obj){return console.log("Please provide data to save")};
  
  try {
    fs.writeFileSync(dbName, JSON.stringify(users));

    return console.log("Save succefull")
    
  } catch (error) {
    return console.log("Save failed")
    
  }
}

app.post("/logout", async (req, res) =>{
   
  console.log(users);
  writeDb_Logout(users);
  req.session.destroy();
  benvenuto = "Benvenuto! In questo gioco dovrai indovinare a quale provincia appartiene il Comune italiano che ti verrà mostrato di volta in volta!"
  await readDb();  
  
});




app.listen(port, () => {
  console.log(`Server running on port: ${port}`);
});