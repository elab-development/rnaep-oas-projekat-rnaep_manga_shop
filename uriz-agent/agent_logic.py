import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

load_dotenv()

def get_risk_analyzer_agent():
    # Inicijalizacija LLM-a
    llm = ChatGoogleGenerativeAI(model="models/gemini-2.5-flash", temperature=0.3)
    output_parser = StrOutputParser()

    # KORAK 1: Analiza kompleksnosti
    prompt1 = ChatPromptTemplate.from_template(
        "Kao Scrum Master, analiziraj kompleksnost zadatka: {summary}. Opis: {description}. "
        "Odredi nivo (Nizak/Srednji/Visok) i objasni zašto na srpskom jeziku."
    )
    chain1 = prompt1 | llm | output_parser

    # KORAK 2: Identifikacija MSF rizika (Prima analizu iz koraka 1)
    prompt2 = ChatPromptTemplate.from_template(
        "Na osnovu ove analize: {complexity_analysis}, identifikuj 2 specifična MSF rizika "
        "za online prodavnicu mangi. Koristi srpski jezik."
    )
    chain2 = prompt2 | llm | output_parser

    # KORAK 3: Plan B (Prima rizike iz koraka 2)
    prompt3 = ChatPromptTemplate.from_template(
        "Za ove rizike: {risk_identification}, predloži Plan B (kontingenciju) u formatu tabele."
    )
    chain3 = prompt3 | llm | output_parser

    # Funkcija koja izvršava višekoračni workflow
    def run_workflow(inputs):
        # Prvi korak
        complexity = chain1.invoke(inputs)
        # Drugi korak (koristi izlaz prvog)
        risks = chain2.invoke({"complexity_analysis": complexity})
        # Treći korak (koristi izlaz drugog)
        final_plan = chain3.invoke({"risk_identification": risks})
        
        return {
            "complexity_analysis": complexity,
            "risk_identification": risks,
            "final_report": final_plan
        }

    return run_workflow