from data_loader import load_backlog_data
from agent_logic import get_risk_analyzer_agent

def main():
    print("--- URIZ AI Agent: JIRA Risk Analyzer ---")
    
    # 1. Učitavanje podataka
    df = load_backlog_data()
    agent = get_risk_analyzer_agent()
    
    # 2. Obrada zadataka (Validacija na 3 primera) [7]
    reports = []
    for index, row in df.iterrows():
        print(f"\nAnaliziram zadatak {row['Task_ID']}: {row['Summary']}...")
        
        result = agent({
            "summary": row['Summary'],
            "description": row['Description']
        })
        
        reports.append(f"## Izveštaj za {row['Task_ID']}\n\n"
                       f"**Analiza:** {result['complexity_analysis']}\n\n"
                       f"**Rizici:** {result['risk_identification']}\n\n"
                       f"**Preporuke:**\n{result['final_report']}\n"
                       f"---")

    # 3. Čuvanje u strukturisan Markdown fajl [2]
    with open("Izvestaj_o_rizicima.md", "w", encoding="utf-8") as f:
        f.write("# Finalni izveštaj AI agenta o rizicima projekta\n\n")
        f.write("\n\n".join(reports))
    
    print("\n[USPEH] Analiza završena. Rezultati su sačuvani u 'Izvestaj_o_rizicima.md'.")

if __name__ == "__main__":
    main()