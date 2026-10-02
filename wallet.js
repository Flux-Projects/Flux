/* Flux wallet: anonymous players (no signup), server-side points, UPI withdrawal requests. */
(function(){
var C=window.FLUX_FIREBASE,RATE=100000;
var W=window.Wallet={ok:false,user:null,points:0,withdrawn:0,best:{},onChange:function(){}};
if(!C||!C.apiKey||!window.firebase)return;
firebase.initializeApp(C);
var auth=firebase.auth(),db=firebase.firestore(),FV=firebase.firestore.FieldValue;
W.ok=true;

auth.onAuthStateChanged(function(u){
  if(!u){auth.signInAnonymously().catch(function(e){console.error(e);W.ok=false;W.onChange()});return}
  W.user=u;var ref=db.doc('users/'+u.uid);
  ref.get().then(function(s){
    if(s.exists)return s;
    return ref.set({points:0,withdrawn:0,best:{}}).then(function(){return ref.get()});
  }).then(function(s){
    var d=s.data();W.points=d.points||0;W.withdrawn=d.withdrawn||0;W.best=d.best||{};W.onChange();
  }).catch(function(e){console.error(e)});
});

/* every level win adds its score */
W.add=function(gain,best){
  W.points+=gain;W.best=best;
  return db.doc('users/'+W.user.uid).update({points:FV.increment(gain),best:best,last:FV.serverTimestamp()}).catch(function(e){console.error(e)});
};

/* creates a pending request; the admin pays it from admin.html */
W.withdraw=function(upi){
  upi=(upi||'').trim();
  if(!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi))return Promise.reject(new Error('Enter a valid UPI ID like name@upi'));
  var avail=W.points-W.withdrawn,rs=Math.floor(avail/RATE);
  if(rs<1)return Promise.reject(new Error('You need 1,00,000 points for ₹1. You have '+avail.toLocaleString()+'.'));
  var pts=rs*RATE,b=db.batch();
  b.set(db.collection('withdrawals').doc(),{uid:W.user.uid,upi:upi,points:pts,rupees:rs,status:'pending',ts:FV.serverTimestamp()});
  b.update(db.doc('users/'+W.user.uid),{withdrawn:FV.increment(pts)});
  return b.commit().then(function(){W.withdrawn+=pts;W.onChange();return 'Request sent: ₹'+rs+' to '+upi+'. Admin will pay it and mark it done.'});
};
})();
