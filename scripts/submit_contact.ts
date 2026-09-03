const response = await fetch("http://localhost:3000/contact", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Morgan Lee",
    email: "morgan@example.com",
    phone: "+1 555 010 2040",
    reason: "appointment_request",
    callbackWindow: "afternoon",
    consentToContact: true,
  }),
});

console.log(response.status, await response.json());
