# data cleaning
import os, re, unicodedata, pandas as pd
import ast
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS

df_new = pd.read_csv("../01.get_new_data/new_data_to_classify.csv")
## remember you need to update this to read from the final final 
df_old = pd.read_csv("both_lab_table.csv")

# normalize DOIs in both dataframes
def clean_doi(x):
    if pd.isna(x): return ""
    x = str(x).strip().lower()
    x = re.sub(r"^https?://(dx\.)?doi\.org/", "", x)
    return x

df_old["doi_clean"] = df_old["DOI"].apply(clean_doi)
df_new["doi_clean"] = df_new["doi"].apply(clean_doi)

# --- find overlap ---
already = set(df_old["doi_clean"].dropna().unique())
mask_new = ~df_new["doi_clean"].isin(already)

df_new_only = df_new[mask_new].reset_index(drop=True)

print("Original new fetch:", len(df_new))
print("Already in previous data:", len(df_new) - mask_new.sum())
print("New unique rows after exclusion:", len(df_new_only))

# convert stringified lists into real lists
def coerce_keywords(val):
    if isinstance(val, list):
        return val
    if isinstance(val, str) and val.startswith("[") and val.endswith("]"):
        try:
            return ast.literal_eval(val)
        except Exception:
            return [val]
    if pd.isna(val):
        return []
    return [val]

df_new_only["keywords"] = df_new_only["keywords"].apply(coerce_keywords)

# now rebuild text
def make_text(row):
    parts = []
    if row["keywords"]:
        parts.append(" ".join(row["keywords"]))
    if pd.notna(row.get("title")):
        parts.append(str(row["title"]))
    if pd.notna(row.get("abstract")):
        parts.append(str(row["abstract"]))
    return " ".join(parts)

df_new_only["text"] = df_new_only.apply(make_text, axis=1)

print(df_new_only["text"].iloc[0][:500])

# --- helpers ---
def to_ascii(s: str) -> str:
    # latin1 -> ascii-ish: normalize then drop non-ASCII
    if s is None:
        return ""
    s = unicodedata.normalize("NFKD", str(s))
    return s.encode("ascii", "ignore").decode("ascii")

# minimal contraction expander (no installs needed)
_CONTRACTIONS = {
    "can't":"cannot","won't":"will not","n't":" not",
    "'re":" are","'s":" is","'d":" would","'ll":" will","'t":" not",
    "'ve":" have","'m":" am","’re":" are","’s":" is","’d":" would",
    "’ll":" will","’t":" not","’ve":" have","’m":" am"
}
_contr_pat = re.compile("|".join(map(re.escape, sorted(_CONTRACTIONS, key=len, reverse=True))))

def expand_contractions(text: str) -> str:
    return _contr_pat.sub(lambda m: _CONTRACTIONS[m.group(0)], text)

STOPWORDS = set(ENGLISH_STOP_WORDS)

def remove_stopwords(text: str) -> str:
    # tokenise on whitespace after basic cleanup
    tokens = text.split()
    return " ".join(t for t in tokens if t not in STOPWORDS)

def clean_text_series(s: pd.Series) -> pd.Series:
    s = s.fillna("").astype(str)

    # 1) convert to ascii
    s = s.apply(to_ascii)

    # 2) remove leading "Keywords" (case-insensitive, optional colon)
    s = s.str.replace(r"^\s*keywords[:\-]?\s*", " ", case=False, regex=True)

    # 3) remove standalone "NA" (start or word boundary)
    s = s.str.replace(r"(^|\s)NA\b", " ", case=False, regex=True)

    # 4) lowercase
    s = s.str.lower()

    # 5) expand contractions
    s = s.apply(expand_contractions)

    # 6) remove punctuation
    s = s.str.replace(r"[^\w\s]", " ", regex=True)

    # 7) remove digits
    s = s.str.replace(r"\d+", " ", regex=True)

    # 8) remove stopwords
    s = s.apply(remove_stopwords)

    # 9) collapse extra whitespace
    s = s.str.replace(r"\s+", " ", regex=True).str.strip()

    return s

# run the cleaner
df_new_only["text"] = clean_text_series(df_new_only["text"])

df_new_only.to_csv("complete_processed_data_no_stem.csv", index=False)

print("saved -> complete_processed_data_no_stem.csv")
df_new_only["text"].head(3).to_list()

# classification
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC

# at some point figure out how to update this after new ones have been reviewed
training = pd.read_csv("training_data_no_stem.csv")
training_text = training["text"]
training_answer = training["class"]

#create tfidf
tv = TfidfVectorizer(use_idf=True, #use tfidf
                    min_df=0.0, #min prop
                    max_df=1.0, #max prop
                    max_features=1500) #final model
                 
#create bag of words on data                   
tv_training_text = tv.fit_transform(training_text)

#build SVM model
svm = LinearSVC(penalty='l2', C=1, random_state=42)

#fit SVM model
svm.fit(tv_training_text, training_answer)

df_new = pd.read_csv("../02.prepare_data/complete_processed_data_no_stem.csv")
df_new_text = df_new["text"].astype(str).tolist()
df_new_tfidf = tv.transform(df_new_text)
df_new["class"] = svm.predict(df_new_tfidf)

# Split by prediction
df_ignore = df_new[df_new["class"] == 0].copy()
df_pipeline = df_new[df_new["class"] == 1].copy()

print("Ignore:", len(df_ignore))
print("Move down pipeline:", len(df_pipeline))

# Save if you want
df_ignore.to_csv("classified_not_lab.csv", index=False)
df_pipeline.to_csv("classified_lab.csv", index=False)

