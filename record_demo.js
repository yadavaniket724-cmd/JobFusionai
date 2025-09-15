/**
 * record_demo.js
 * Usage: node record_demo.js
 * It will navigate the app running on http://localhost:3000 and take screenshots of the flow into demo/frames.
 * Requirements: npm install puppeteer
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

(async ()=>{
  const framesDir = path.join(__dirname,'frames');
  if(!fs.existsSync(framesDir)) fs.mkdirSync(framesDir, {recursive:true});
  const browser = await puppeteer.launch({headless:true, args:['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  page.setViewport({width:1200, height:900});
  const url = process.env.APP_URL || 'http://localhost:3000';
  let i = 0;
  const snap = async (name)=>{
    const fn = path.join(framesDir,`frame_${String(i).padStart(3,'0')}.png`);
    await page.screenshot({path:fn, fullPage:true});
    console.log('Saved',fn);
    i++;
  };

  await page.goto(url, {waitUntil:'networkidle2'});
  await snap('home');
  // click Start -> Resume
  await page.click('#startBtn');
  await page.waitForSelector('#frmResume', {visible:true});
  await snap('resume_page');
  // upload resume
  const resumePath = path.join(__dirname,'sample_resume.txt');
  const input = await page.$('input[name=resume]');
  await input.uploadFile(resumePath);
  await page.click('#frmResume button[type=submit]');
  await page.waitForSelector('#scanResult', {visible:true});
  await page.waitForTimeout(1000);
  await snap('after_scan');
  // go to JD
  await page.click("a.nav-link[href='#']"); // not reliable - instead navigate to JD page via showPage
  await page.evaluate(()=>showPage('pageJD'));
  await page.waitForSelector('#frmJD', {visible:true});
  await snap('jd_page');
  // paste JD text
  const jdText = fs.readFileSync(path.join(__dirname,'sample_jd.txt'),'utf-8');
  await page.evaluate((t)=>{ document.getElementById('jdText').value = t; }, jdText);
  await snap('jd_pasted');
  // click Analyze
  await page.click('#btnAnalyze');
  // wait and then snapshot analyze result (analyze triggers navigation to resume if resume missing? ensure resumeFileId present)
  await page.waitForTimeout(2000);
  await snap('after_analyze');
  // go to Step3 and generate interview Qs
  await page.evaluate(()=>showPage('pageStep3'));
  await page.click('#btnToInterview');
  await page.waitForSelector('#qList', {visible:true});
  await page.waitForTimeout(1000);
  await snap('interview_questions');
  await browser.close();
  console.log('Done capturing frames in', framesDir);
})();