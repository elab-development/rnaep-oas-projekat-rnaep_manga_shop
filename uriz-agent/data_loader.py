import pandas as pd

def load_backlog_data(file_path=None):
    """
    Učitava zadatke iz CSV fajla ili koristi testne podatke ako fajl ne postoji.
    """
    if file_path:
        return pd.read_csv(file_path)
    
    # Testni podaci na osnovu tvog JIRA projekta za prodavnicu mangi
    data = {
        'Task_ID': ['SCRUM-10', 'SCRUM-14', 'SCRUM-16'],
        'Summary': ['Registracija novog korisnika', 'Realizacija kupovine preko Stripe servisa', 'Integracija sa Stripe API'],
        'Description': [
            'Korisnik treba da unese email i lozinku.',
            'Korisnik unosi podatke sa kartice u Stripe formi.',
            'Povezivanje backend servisa sa Stripe testnim okruženjem.'
        ]
    }
    return pd.DataFrame(data)