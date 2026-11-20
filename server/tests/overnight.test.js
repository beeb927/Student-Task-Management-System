const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const validate = require('../utils/validate');
const source = fs.readFileSync(path.join(__dirname,'../controllers/scheduleController.js'),'utf8');
const sandbox={module:{exports:{}},console,require(name){
 if(name.includes('scheduleModel')) return {createClass:async()=>1,findClass:async()=>({id:1}),updateClass:async()=>1};
 if(name.includes('courseModel')) return {findCourse:async()=>null};
 return validate;
}};
vm.runInNewContext(source,sandbox);
for(const action of ['addClass','editClass']) {
 for(const [type,startTime,endTime,expected] of [['Sleep','23:00','07:00',action==='addClass'?201:200],['Sleep','23:00','00:00',action==='addClass'?201:200],['Sleep','07:00','07:00',400],['Lecture','23:00','07:00',400],['Sleep','25:00','07:00',400]]) {
 test(`${action}: ${type} ${startTime}-${endTime}`,async()=>{
  let status=200;
  const res={status(code){status=code;return this;},json(){return this;}};
  await sandbox.module.exports[action]({user:{id:1},params:{id:1},body:{title:'Test',dayOfWeek:7,type,startTime,endTime}},res);
  assert.equal(status,expected);
 });
}

}
