/* UTF-8 CSV preview only. Saving remains the owned storeStaffBatch transaction. */
(() => {
 'use strict';
 function parse(text){
   if(typeof text!=='string'||text.includes('\uFFFD'))throw Error('请上传 UTF-8 编码的 CSV 文件');
   text=text.replace(/^\uFEFF/,'');const records=[];let row=[],cell='',quoted=false,closed=false;
   const push=()=>{row.push(cell.trim());cell='';closed=false;};
   for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
     if(c==='"'){if(cell||closed)throw Error('CSV 引号格式不正确');quoted=true;}
     else if(c===','){push();}
     else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;push();if(row.some(Boolean))records.push(row);row=[];}
     else if(closed){if(!/\s/.test(c))throw Error('CSV 引号后只能有分隔符');}
     else cell+=c;
   }
   if(quoted)throw Error('CSV 引号未闭合');push();if(row.some(Boolean))records.push(row);
   const header=records.shift();if(!header||header.length!==2||header[0]!=='员工姓名'||!['电话','手机号'].includes(header[1]))throw Error('请使用员工模板，表头为“员工姓名,电话”');
   if(!records.length||records.length>100)throw Error('每批请上传 1 至 100 名员工');
   const phones=new Set();return records.map((cells,index)=>{const name=cells[0]||'',mobile=cells[1]||'';let error='';if(cells.length!==2)error='应有员工姓名、电话两列';else if(!name||Array.from(name).length>50||/[\u0000-\u001F]/.test(name))error='员工姓名须为 1 至 50 个字符';else if(!/^1[3-9]\d{9}$/.test(mobile))error='请填写有效的 11 位手机号';else if(phones.has(mobile))error='文件内手机号重复';phones.add(mobile);return {name,mobile,line:index+2,error};});
 }
 window.MerchantStaffImport={parse};
})();
