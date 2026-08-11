const express=require("express"); const path=require("path");
const multer=require("multer");
const fs=require("fs");

const app=express(); app.use("/admin",express.static(path.join(__dirname,"admin")));
const PORT=process.env.PORT||3000;
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||"change-this-password";
const DATA=path.join(__dirname,"data");
const MUSIC=path.join(DATA,"music");
fs.mkdirSync(MUSIC,{recursive:true});
const dbFile=path.join(DATA,"songs.json");
if(!fs.existsSync(dbFile))fs.writeFileSync(dbFile,"[]");
const read=()=>JSON.parse(fs.readFileSync(dbFile,"utf8"));
const write=x=>fs.writeFileSync(dbFile,JSON.stringify(x,null,2));
const storage=multer.diskStorage({destination:(req,f,cb)=>cb(null,MUSIC),filename:(req,f,cb)=>{
 const ext=path.extname(f.originalname).toLowerCase(); const safe=Date.now()+"-"+Math.random().toString(36).slice(2)+ext; cb(null,safe);
}});
const upload=multer({storage,fileFilter:(req,f,cb)=>cb(null,/^audio\/|\.mp3$|\.wav$|\.m4a$|\.ogg$|\.aac$/i.test(f.mimetype+" "+f.originalname))});

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname,"public"))); app.get("/",(req,res)=>res.sendFile(path.join(__dirname,"index.html")));
app.use("/music",express.static(MUSIC));
app.use("/admin",express.static(path.join(__dirname,"admin")));

function auth(req,res,next){
 const token=req.headers.authorization||"";
 if(token==="Bearer "+ADMIN_PASSWORD)return next();
 res.status(401).json({error:"Unauthorized"});
}
app.get("/api/songs",(req,res)=>res.json(read()));
app.post("/api/login",(req,res)=>res.json({ok:req.body.password===ADMIN_PASSWORD,token:ADMIN_PASSWORD}));
app.post("/api/songs",auth,upload.fields([
  {name:"audio",maxCount:50},
  {name:"cover",maxCount:1}
]),(req,res)=>{

  if(!req.files?.audio?.length){
    return res.status(400).json({error:"Audio file required"});
  }

  const songs=req.files.audio.map(file=>({
    id:Date.now().toString()+"-"+Math.random().toString(36).slice(2),
    title:path.parse(file.originalname).name,
    artist:req.body.artist||"Unknown artist",
    audio:"/music/"+file.filename,
    cover:req.files.cover?.[0]
      ? "/music/"+req.files.cover[0].filename
      : "",
    createdAt:new Date().toISOString()
  }));

  const all=read();

  songs.reverse().forEach(song=>all.unshift(song));

  write(all);

  res.json({
    ok:true,
    count:songs.length,
    songs
  });
});
