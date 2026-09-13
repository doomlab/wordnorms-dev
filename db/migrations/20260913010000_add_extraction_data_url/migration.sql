-- Where the raw norms/stimuli data can actually be downloaded (OSF, Figshare, GitHub, etc.),
-- as distinct from licenseUrl (what license it's released under)
ALTER TABLE "PaperExtraction" ADD COLUMN "dataUrl" TEXT;
