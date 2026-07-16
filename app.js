import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

const firebaseConfig = { apiKey:"AIzaSyCGZShK1q-9DvjAOMf9Gx5PapeGOUrygqk", authDomain:"mail-receipt-log.firebaseapp.com", projectId:"mail-receipt-log", storageBucket:"mail-receipt-log.firebasestorage.app", messagingSenderId:"1041574064117", appId:"1:1041574064117:web:beda0412571b8182537abc" };
const ADMIN_EMAIL = "fa@impact.co.th";
const types = ["ใบแจ้งหนี้","ใบเสร็จ/ใบกำกับภาษี","หนังสือรับรองหัก ณ ที่จ่าย","หนังสือราชการ","จดหมายทั่วไป","อื่น ๆ"];
const app = initializeApp(firebaseConfig), db = getFirestore(app), auth = getAuth(app);
const $ = (id) => document.getElementById(id);
let rows = [], isAdmin = false, mode = "";
const thaiDate = (value) => value ? new Intl.DateTimeFormat("th-TH",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(`${value}T00:00:00`)) : "—";
const dateISO = () => new Date().toISOString().slice(0,10);
$("today").textContent = thaiDate(dateISO());

function flash(message){ const box=$("notice");box.textContent=message;box.classList.remove("hidden");setTimeout(()=>box.classList.add("hidden"),4000); }
function openModal(nextMode, item){ mode=nextMode; const content=$("modalContent");
  if(nextMode==="login") content.innerHTML=`<p class="eyebrow">ADMIN ONLY</p><h3>เข้าสู่ระบบผู้ดูแล</h3><label>อีเมล<input id="loginEmail" type="email" value="${ADMIN_EMAIL}" required></label><label>รหัสผ่าน<input id="loginPassword" type="password" required autofocus></label><button id="loginSubmit" class="primary full">เข้าสู่ระบบ</button>`;
  if(nextMode==="receive") content.innerHTML=`<p class="eyebrow">ยืนยันการรับ</p><h3>รับเอกสารแล้ว</h3><p class="modal-copy">${item.sender} ถึง ${item.recipient}</p><label>ชื่อผู้รับเอกสาร<input id="receiverName" placeholder="กรอกชื่อ-นามสกุล" autofocus></label><button id="receiveSubmit" class="primary full">ยืนยันรับเอกสาร</button>`;
  if(nextMode==="add") content.innerHTML=`<p class="eyebrow">ADMIN</p><h3>เพิ่มรายการจดหมาย</h3><div class="form-grid"><label>วันที่รับจดหมาย<input id="receivedDate" type="date" value="${dateISO()}" required></label><label>Tracking No.<input id="trackingNo"></label><label>ผู้ส่ง<input id="sender" required></label><label>ผู้รับ<input id="recipient" required></label><label class="wide">ประเภทเอกสาร<select id="documentType">${types.map(x=>`<option>${x}</option>`).join("")}</select></label></div><button id="addSubmit" class="primary full">บันทึกรายการ</button>`;
  $("modal").classList.remove("hidden");
  if(nextMode==="login") $("loginSubmit").onclick=login;
  if(nextMode==="receive") $("receiveSubmit").onclick=()=>receive(item.id);
  if(nextMode==="add") $("addSubmit").onclick=addMail;
}
function closeModal(){ $("modal").classList.add("hidden"); }
async function login(){ try{ const email=$("loginEmail").value.trim();if(email!==ADMIN_EMAIL)throw new Error("อีเมลนี้ไม่มีสิทธิ์ Admin");await signInWithEmailAndPassword(auth,email,$("loginPassword").value);closeModal();flash("เข้าสู่ระบบผู้ดูแลเรียบร้อยแล้ว"); }catch(e){flash(e.message||"ไม่สามารถเข้าสู่ระบบได้");} }
async function receive(id){ const receivedBy=$("receiverName").value.trim();if(!receivedBy)return flash("กรุณากรอกชื่อผู้รับเอกสาร");try{await updateDoc(doc(db,"mailItems",id),{status:"รับเอกสารแล้ว",receivedBy,collectedDate:dateISO(),updatedAt:serverTimestamp()});closeModal();flash("ยืนยันการรับเอกสารเรียบร้อยแล้ว");}catch(e){flash("ไม่สามารถบันทึกได้ กรุณาลองใหม่");} }
async function addMail(){ const receivedDate=$("receivedDate").value,sender=$("sender").value.trim(),recipient=$("recipient").value.trim();if(!receivedDate||!sender||!recipient)return flash("กรุณากรอกข้อมูลที่จำเป็นให้ครบ");try{await addDoc(collection(db,"mailItems"),{receivedDate,trackingNo:$("trackingNo").value.trim(),sender,recipient,documentType:$("documentType").value,status:"รอรับเอกสาร",receivedBy:"",collectedDate:"",createdAt:serverTimestamp()});closeModal();flash("บันทึกรายการจดหมายเรียบร้อยแล้ว");}catch(e){flash("ไม่สามารถบันทึกรายการได้");} }
async function returnMail(id){try{await updateDoc(doc(db,"mailItems",id),{status:"ส่งคืน/ตีกลับ",updatedAt:serverTimestamp()});flash("เปลี่ยนสถานะเป็นส่งคืน/ตีกลับแล้ว");}catch(e){flash("ไม่สามารถเปลี่ยนสถานะได้");}}
function render(){const q=$("search").value.toLowerCase(),filter=$("statusFilter").value;const filtered=rows.filter(x=>(filter==="ทั้งหมด"||x.status===filter)&&[x.sender,x.recipient,x.trackingNo].join(" ").toLowerCase().includes(q));$("waitingCount").textContent=rows.filter(x=>x.status==="รอรับเอกสาร").length;$("collectedCount").textContent=rows.filter(x=>x.status==="รับเอกสารแล้ว").length;$("returnedCount").textContent=rows.filter(x=>x.status==="ส่งคืน/ตีกลับ").length;$("mailRows").innerHTML=filtered.length?filtered.map(x=>`<tr><td>${thaiDate(x.receivedDate)}</td><td>${x.trackingNo||"—"}</td><td>${x.sender}</td><td class="recipient">${x.recipient}</td><td>${x.documentType}</td><td><span class="badge ${x.status==="รับเอกสารแล้ว"?"done":x.status==="ส่งคืน/ตีกลับ"?"returned":"waiting"}">${x.status}</span></td><td>${x.receivedBy||"—"}</td><td>${thaiDate(x.collectedDate)}</td><td>${x.status==="รอรับเอกสาร"?`<button class="receive" data-receive="${x.id}">รับเอกสาร</button>`:isAdmin&&x.status!=="ส่งคืน/ตีกลับ"?`<button class="return" data-return="${x.id}">ตีกลับ</button>`:""}</td></tr>`).join(""):`<tr><td colspan="9" class="empty">ยังไม่พบรายการจดหมาย</td></tr>`;document.querySelectorAll("[data-receive]").forEach(b=>b.onclick=()=>openModal("receive",rows.find(x=>x.id===b.dataset.receive)));document.querySelectorAll("[data-return]").forEach(b=>b.onclick=()=>returnMail(b.dataset.return);)}
$("adminButton").onclick=()=>isAdmin?signOut(auth):openModal("login");$("addButton").onclick=()=>openModal("add");$("closeModal").onclick=closeModal;$("search").oninput=render;$("statusFilter").onchange=render;
onAuthStateChanged(auth,user=>{isAdmin=Boolean(user&&user.email===ADMIN_EMAIL);$("addButton").classList.toggle("hidden",!isAdmin);$("adminButton").textContent=isAdmin?"ออกจากระบบ Admin":"เข้าสู่ระบบ Admin";render();});
onSnapshot(query(collection(db,"mailItems"),orderBy("createdAt","desc")),snapshot=>{rows=snapshot.docs.map(d=>({id:d.id,...d.data()}));render();},()=>flash("ยังไม่สามารถเชื่อมต่อฐานข้อมูลได้"));
