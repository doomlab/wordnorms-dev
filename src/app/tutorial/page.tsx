import Image from "next/image"
import { Navbar } from "../components/Navbar"

export const metadata = { title: "How to Verify Your Paper" }

function Img({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={1200}
      height={700}
      className="rounded-xl border border-base-200 w-full h-auto"
    />
  )
}

function Step({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-6">
      <div className="flex flex-col items-center">
        <div className="w-9 h-9 rounded-full bg-primary text-primary-content flex items-center justify-center text-sm font-bold shrink-0">
          {number}
        </div>
        <div className="w-px flex-1 bg-base-300 mt-2" />
      </div>
      <div className="pb-12 flex-1 min-w-0">
        <h2 className="text-lg font-semibold mb-3">{title}</h2>
        <div className="flex flex-col gap-4 text-base-content/70 text-sm leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  )
}

export default function TutorialPage() {
  return (
    <div className="min-h-screen bg-base-100">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-3">How to verify your paper</h1>
          <p className="text-base-content/60 leading-relaxed">
            WordNorms uses an AI model to extract key information from language resource papers —
            things like what norms were collected, how many stimuli were used, and what kind of
            participants were tested. We invite authors to review and correct this information so
            the database stays accurate, and we have training data to create better models. This
            guide walks you through the process.
          </p>
        </div>

        <div className="flex flex-col">
          <Step number={1} title="Create an account">
            <p>
              You need a WordNorms account to submit corrections. Go to{" "}
              <a href="/signup" className="link link-primary">
                manynorms.wordnorms.com/signup
              </a>{" "}
              and create a free account using your email address. If you already have an account,
              just{" "}
              <a href="/login" className="link link-primary">
                log in
              </a>
              .
            </p>
            <Img src="/images/tutorial/signup.jpg" alt="Signup page with email and password fields" />
          </Step>

          <Step number={2} title="Find your paper">
            <p>
              If you received an email from us, it includes a direct link to your paper — click it
              to go straight to the verification page. You can also search for your paper from the
              home page by typing your name or paper title into the search bar.
            </p>
            <Img src="/images/tutorial/email-link.jpg" alt="Search page showing results for 'buchanan'" />
          </Step>

          <Step number={3} title="Review the extracted information">
            <p>
              The paper detail page shows everything our model extracted: language, norms collected,
              stimuli type and count, participant type and count, instructions, and more. Note that
              all of this is automatically extracted by our model, so it may not be correct —
              that&apos;s why we need your help to verify it. Even if a value is right, it may be
              missing the evidence sentence that supports it, which you can add to help train better
              models.
            </p>
            <Img src="/images/tutorial/paper-detail.png.jpg" alt="Paper detail page showing the Extracted Information section with a Suggest edits button" />
            <p>
              Click <strong>Suggest edits</strong> in the top-right corner of the Extracted
              information section to open the correction form.
            </p>
          </Step>

          <Step number={4} title="Correct any fields that are wrong">
            <p>
              The correction page has two panels: the form on the left and the full paper text on
              the right for reference. Each field shows the model&apos;s <strong>answer</strong> and
              the <strong>evidence</strong> — the sentence it used to arrive at that answer. Below
              those, you enter your own answer and evidence.
            </p>
            <Img src="/images/tutorial/suggest-edits.jpg" alt="Two-panel suggest-edit page showing a Language field with model answer, model evidence, and editable your-answer and your-evidence sections" />
            <p>
              If the model got a field right, you can leave your answer as-is. If it&apos;s wrong,
              update <strong>Your answer</strong> to the correct value. For{" "}
              <strong>Your evidence</strong>, paste the sentence(s) from the paper that support your
              answer, or click <em>Select from paper text</em> and highlight the sentence directly
              in the right panel — it will be captured automatically.
            </p>
            <Img src="/images/tutorial/field-block.jpg" alt="A single field block with the Language field filled in, showing model answer, model evidence, and a completed your-answer field" />
            <p>
              If the supporting text isn&apos;t in the main manuscript — for example, the
              participant count wasn&apos;t reported, or the evidence is only in a supplement —
              check the <strong>No evidence</strong> box instead of leaving the evidence blank. You
              can still enter the correct answer in the <strong>Your answer</strong> field if you
              know it; we just won&apos;t use that field for model training since there&apos;s no
              text to learn from.
            </p>
          </Step>

          <Step number={5} title="Add a note and submit">
            <p>
              At the bottom of the form you can add an optional <strong>Note</strong> to explain
              anything unusual about your corrections — for example, if a value only appears in a
              supplement or if the paper has two experiments with different counts. You can also add
              a dataset URL if the data is hosted somewhere. When you&apos;re done, click{" "}
              <strong>Submit suggestion</strong>.
            </p>
            <Img src="/images/tutorial/submit-suggestion.jpg" alt="Bottom of the suggestion form showing Note and Website URL fields and a Submit suggestion button" />
            <p>
              Your corrections will be reviewed by our team and applied to the database. You can
              come back later to update your suggestion — just return to the paper page and click{" "}
              <em>Edit suggestion submitted ✓</em>.
            </p>
          </Step>
        </div>

        <div className="rounded-xl border border-base-200 bg-base-200/30 px-6 py-5 text-sm text-base-content/60">
          <p className="font-medium text-base-content/80 mb-1">Questions?</p>
          <p>
            Email{" "}
            <a href="mailto:buchananlab@gmail.com" className="link link-primary">
              buchananlab@gmail.com
            </a>{" "}
            and we&apos;ll help you out.
          </p>
        </div>
      </div>
    </div>
  )
}
