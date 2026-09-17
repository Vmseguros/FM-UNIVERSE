# Especificação Técnica de Importação de Jogadores: FM26 -> FM Universe

Este documento define as diretrizes, layout de colunas, tipos de dados, regras de normalização e fluxo operacional para a importação em massa de atletas exportados do **Football Manager 2026** (FM26) para a plataforma **FM Universe**.

---

## 1. Visão Geral e Arquitetura

O FM Universe foi desenhado para receber bancos de dados com milhares de atletas (desde 100 até mais de 50.000 jogadores). Para garantir integridade, velocidade e evitar duplicidade com atletas fictícios pré-existentes, o processo de importação opera através de um pipeline em 6 etapas:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Export FM26  │ ──> │ FM Universe  │ ──> │  Validação   │
│  (CSV/HTML)  │     │   Parser     │     │  Sintática   │
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
                                                 ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Firestore   │ <── │ Confirmação  │ <── │ Normalização │
│  Persistência│     │   / Preview  │     │ & Deduplic.  │
└──────────────┘     └──────────────┘     └──────────────┘
```

---

## 2. Formatos Suportados

| Formato | Prioridade | Descrição |
| :--- | :--- | :--- |
| **CSV (Separador `;` ou `,`)** | **Recomendado** | Codificação UTF-8 ou Windows-1252. Cabeçalho obrigatório na primeira linha. Ideal para processamento em streaming. |
| **HTML (Export de Tabela FM)** | Alternativo | Arquivo `.html` gerado pela função nativa do Football Manager *"Imprimir / Exportar para Página Web"*. O parser extrairá a `<table>` principal. |

---

## 3. Mapeamento de Colunas e Tipos de Dados

O parser aceita cabeçalhos tanto em **Português (FM PT/PT-BR)** quanto em **Inglês (FM EN)**.

### 3.1. Identificação & Biometria

| Campo FM Universe | Coluna FM26 (PT) | Coluna FM26 (EN) | Tipo | Obrigatório? | Default / Fallback |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `externalId` | `UID` / `ID Único` | `UID` / `Unique ID` | string | Recomendado | `undefined` (ativa chave biométrica) |
| `name` | `Nome` | `Name` | string | **Sim** | — |
| `fullName` | `Nome Completo` | `Full Name` | string | Não | Igual a `name` |
| `knownAs` | `Apelido` | `Nickname` | string | Não | `undefined` |
| `birthDate` | `Data de Nasc.` | `Date of Birth` | string (ISO/BR) | Não | `undefined` |
| `age` | `Idade` | `Age` | number | **Sim** | Calculado de birthDate ou `24` |
| `nationality` | `Nacionalidade` | `Nationality` | string | **Sim** | `"Brasil"` |
| `nationalityCode` | `País (Cód)` | `Nat Code` | string (3 letras) | Não | Derivado da nacionalidade (ex: `BRA`) |
| `secondNationality` | `2ª Nacionalidade` | `Second Nat` | string | Não | `undefined` |
| `preferredFoot` | `Pé Preferido` | `Left/Right Foot` | enum | Não | `"Destro"` (`"Ambidestro"` / `"Canhoto"`) |
| `height` | `Altura` | `Height` | number (cm) | Não | `undefined` |
| `weight` | `Peso` | `Weight` | number (kg) | Não | `undefined` |
| `avatarUrl` | `Foto` | `Face URL` | string (URL) | Não | Avatar placeholder com iniciais |

### 3.2. Vínculo Contratual & Mercado (100% em BRL / R$)

> **Atenção:** Se o export original estiver em EUR (€) ou GBP (£), o importador aplicará o fator de conversão cambial configurável no preview. O FM Universe opera exclusivamente em Reais (R$).

| Campo FM Universe | Coluna FM26 (PT) | Coluna FM26 (EN) | Tipo | Default |
| :--- | :--- | :--- | :--- | :--- |
| `clubName` | `Clube` | `Club` | string | `"Sem Clube"` |
| `wage` | `Salário` | `Wage` | number (R$/mês) | `50000` |
| `marketValue` | `Valor` | `Value` | number (R$) | `1000000` (ou calculado por OVR) |
| `contractUntil` | `Expira em` | `Expires` | string (ano) | `"2027-12-31"` |
| `releaseClause` | `Cláusula Rescisória` | `Release Clause` | number (R$) | `undefined` |

### 3.3. Posições & Categorias

| Campo FM Universe | Valores Aceitos | Conversão Automática para Categoria |
| :--- | :--- | :--- |
| `position` | `GK`, `CB`, `LB`, `RB`, `LWB`, `RWB`, `CDM`, `CM`, `CAM`, `LM`, `RM`, `LW`, `RW`, `ST`, `CF` | Mapeado para `GK`, `DEF`, `MID` ou `FWD` |
| `detailedPositions` | Lista separada por vírgulas (ex: `["CM", "CAM"]`) | Array de posições secundárias |

### 3.4. Atributos Canônicos (Escala FM 1-20 -> Conversão FM Universe 0-99)

O FM exporta atributos em escala **1 a 20**. O FM Universe armazena tanto os atributos nativos de 1 a 20 (`technicalAttributes`, `mentalAttributes`, `physicalAttributes`) quanto os sintetiza para o cluster de 6 índices de **0 a 99** (`attributes.pace`, `shooting`, `passing`, `dribbling`, `defending`, `physical`).

*Fórmula de Normalização:*
$$\text{Atributo}_{99} = \text{round}\left(\frac{\text{Atributo}_{20}}{20} \times 99\right)$$

*Cálculo de Overall (OVR):*
- Ponderado pela posição do atleta com base nos atributos chave (Goleiros: reflexos/posicionamento; Atacantes: finalização/compostura/velocidade; Meias: passe/visão/técnica; Zagueiros: desarme/marcação/força).

---

## 4. Estratégia de Identificação e Deduplicação

Para evitar duplicar jogadores ou sobrescrever atletas de elencos existentes:

1. **UID Oficial (Chave Primária):**
   Se o `externalId` estiver presente, gera a chave `fmu_ext_{externalId}`.
2. **Chave Biométrica Composta (Fallback):**
   Gera `fmu_bio_{nome_normalizado}_{data_nasc_ou_idade}_{nacionalidade}`.
3. **Resolução de Conflitos no Preview:**
   - Se o atleta já existir no FM Universe:
     - Opção A: **Atualizar Atributos** (mantém clube atual e contrato).
     - Opção B: **Ignorar** (preserva o registro existente).
     - Opção C: **Sobrescrever Completo**.

---

## 5. Exemplo de Linha CSV de Entrada

```csv
UID;Nome;Nome Completo;Idade;Data Nasc;Nacionalidade;Segunda Nac;Posicao;Clube;Salario;Valor Mercado;Finalizacao;Passe;Drible;Desarme;Velocidade;Forca;Visao
19052026;Endrick;Endrick Felipe Moreira de Sousa;19;21/07/2006;Brasil;Espanha;ST;Real Madrid;1200000;250000000;16;14;16;7;18;15;14
```

---

## 6. Próximos Passos para Ativação

1. O modelo canônico e os métodos de paginação e deduplicação já estão implantados no `src/types.ts`, `src/services/dataStore.ts`, `src/services/jogadoresService.ts` e `src/utils/playerDeduplication.ts`.
2. Quando os arquivos reais do FM26 estiverem prontos, a tela de importação administrativa utilizará o parser baseado nesta especificação para apresentar a tela de Pré-Visualização e Auditoria antes do commit no banco de dados.
