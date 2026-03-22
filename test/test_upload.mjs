import fs from 'fs';

async function test() {
  console.log("Authenticating...");
  const loginRes = await fetch("http://localhost:8000/api/v1/auth/token", {
    method: "POST", 
    body: new URLSearchParams({username: "admin", password: "password"})
  });
  
  if (!loginRes.ok) {
     console.error("Login failed", await loginRes.text());
     process.exit(1);
  }
  const { access_token } = await loginRes.json();
  
  console.log("Reading dummy PDF...");
  const fileData = fs.readFileSync("test/dummy/mock/pumpkin_pie.pdf");
  const blob = new Blob([fileData]);
  
  const formData = new FormData();
  formData.append("topic_title", "Cooking/Baking");
  formData.append("file", blob, "pumpkin_pie.pdf");
  
  console.log("Sending Atomic Upload Pipeline (Chunking -> Embedding -> Flashcard Generation)...");
  const start = Date.now();
  
  const res = await fetch("http://localhost:8000/api/v1/admin/upload", {
    method: "POST", 
    headers: { "Authorization": "Bearer " + access_token }, 
    body: formData
  });
  
  const json = await res.json();
  const timeSec = (Date.now() - start)/1000;
  
  console.log("Result:", json);
  console.log("Pipeline Execution Time:", timeSec, "seconds");
}

test().catch(console.error);
