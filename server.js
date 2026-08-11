const express=require("express");
const multer=require("multer");
const fs=require("fs");
const path=require("path");
const app=express();
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
app.use(express.static(path.join(__dirname,"public")));
app.use("/music",express.static(MUSIC));
app.use("/admin",express.static(path.join(__dirname,"admin")));

function auth(req,res,next){
 const token=req.headers.authorization||"";
 if(token==="Bearer "+ADMIN_PASSWORD)return next();
 res.status(401).json({error:"Unauthorized"});
}
app.get("/api/songs",(req,res)=>res.json(read()));
app.post("/api/login",(req,res)=>res.json({ok:req.body.password===ADMIN_PASSWORD,token:ADMIN_PASSWORD}));
app.post("/api/songs",auth,upload.fields([{name:"audio",maxCount:1},{name:"cover",maxCount:1}]),(req,res)=>{
 if(!req.files?.audio?.[0])return res.status(400).json({error:"Audio file required"});
 const s={id:Date.now().toString(),title:req.body.title||path.parse(req.files.audio[0].originalname).name,artist:req.body.artist||"Unknown artist",
 audio:"/music/"+req.files.audio[0].filename,cover:req.files.cover?.[0]?"/music/"+req.files.cover[0].filename:"",createdAt:new Date().toISOString()};
 const all=read();all.unshift(s);write(all);res.json(s);
});
app.delete("/api/songs/:id",auth,(req,res)=>{
 const all=read();const s=all.find(x=>x.id===req.params.id);if(!s)return res.status(404).json({error:"Not found"});
 [s.audio,s.cover].forEach(u=>{if(u){const f=path.join(__dirname,"data",u.replace("/music/","music/"));if(fs.existsSync(f))fs.unlinkSync(f)}});
 write(all.filter(x=>x.id!==req.params.id));res.json({ok:true});
});
app.listen(PORT,()=>console.log("Auto Wala running on http://localhost:"+PORT));
