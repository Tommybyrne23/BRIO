#tools
OpenAI Credits
Manus Credits
Google Cloud 100 usd 

#MVP
The MVP should offer granular consent, a recommendation audit trail and export/deletion controls, and avoid diagnostics or automatic medical instruction.

#Architecture

should launch as a TypeScript-first, serverless product with a mobile health-
data companion and a responsive web workspace.
Not a chat app.

The app should encourage users to use the native 'Connect to Apple Health / Health Centre' which would be more beneficial for linking data back to us.

#techstack 
Expo React Native for mobile, Next.js on Vercel for web and authenticated APIs, Supabase for identity, Postgres, row-level security and private storage, Inngest for durable workflows and approval waits, and the OpenAI Responses API plus the TypeScript Agents SDK for structured model/tool orchestration. This divides responsibility cleanly: the database owns truth, the workflow engine owns long-lived state, the policy service owns safety, and the model is a bounded reasoning component—not the system of record.

#safety
event-driven decision system that stores its own durable training ledger, uses explicit policy rules before and after model reasoning, waits for human approval before consequential actions, and records every recommendation, override and outcome.

Design invariant: An agent may prepare a proposed session adjustment and complete a reversible workflow task after approval. It may not silently change a programme, make a medical claim, write back to a provider without an approved connector, or use raw health data in product analytics.

Data minimisation is very important in the Irish Market as health data is seen as special.

definitely need to have information on EU Health Data security and Irish Health Data security researched before the demo

#UX
The user should be made link their calorie tracking app if they are deciding to use their own
If the user pays for subscriptions, they should be given the option to use their own subscriptions and can merge into the [[Brio Calorie]] tracker if they need to.

#competition
Why not just connect everything to apple health or andriod health connect??

#GTM
Do you sit in the office all day and you want to improve your fitness, but you don't know where to start? Between eating right, sleeping right (sometimes) and getting time to work out, you mightn't know how they work together to make everything easier, this is where BRIO comes in
The Healthy Ireland Survey 2024 also found that 67% of people not meeting activity guidelines would like to be more active. [6]
![['/Users/armand/Downloads/Validating and Shaping AI Challenge Idea/Business Model/Idea_Validation.pdf']]
