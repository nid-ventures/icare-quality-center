# Page snapshot

```yaml
- generic [ref=e5]:
  - generic [ref=e6]:
    - img "coming_soon" [ref=e8]
    - heading "Calendrier des rendez-vous" [level=3] [ref=e9]
    - paragraph [ref=e10]: Bienvenu à la plateforme de planification des rendez-vous médicaux
  - generic [ref=e12]:
    - heading "Connexion" [level=2] [ref=e13]
    - paragraph [ref=e14]: Entrer votre email et mot de passe pour vous connecter
    - generic [ref=e15]:
      - generic [ref=e16]:
        - generic [ref=e17]: Email
        - textbox "Nom d'utilisateur" [ref=e18]
      - generic [ref=e19]:
        - generic [ref=e20]: Mot de passe
        - textbox "Mot de passe" [ref=e21]
        - button [ref=e22] [cursor=pointer]:
          - img [ref=e23]
      - button "Se connecter" [ref=e26] [cursor=pointer]
    - link "Mot de passe oublié ?" [ref=e28] [cursor=pointer]:
      - /url: /auth/forgot-password
```