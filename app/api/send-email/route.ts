import { Resend } from "resend";
import { arrayBuffer } from "stream/consumers";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(request: Request) {
  // Parse the request body
  const body = await request.json();
  const { email, output } = body;
    const columnNames = Object.keys(output[0]);
    // console.log(columnNames)
  
    const rows = output.slice(1);
    console.log("Rows:", rows)


    for(let row = 0; row < rows.length; row++) {
        console.log("Row ", row, ": ", rows[row]);
    }
  resend.emails.send({
  from: 'onboarding@resend.dev',
  to: 'hkatyal_be23@thapar.edu',
//   to: email,
  subject: 'Topsis Analysis Result',
  html: `
    <h1>Your Topsis Analysis is Complete</h1>
    <p>Dear User,</p>
    <p>Your Topsis analysis has been successfully completed. Please find the results attached below:</p>
    <table>
    <tr>
        ${columnNames.map((col: string) => `<th style="border: 1px solid black; padding: 8px;">${col}</th>`).join('')}
    </tr>
    ${rows.map((row: any[]) => `
        <tr>
            ${Object.values(row).map((cell: any) => `<td style="border: 1px solid black; padding: 8px;">${cell}</td>`).join('')}
        </tr>
    `).join('')}    
    </table>
    <p>Thank you for using our Topsis service!</p>
    <p>Best regards,<br/>Harshit Katyal</p>
  `
});

  return new Response(JSON.stringify({message: "Email sent successfully"}), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
}