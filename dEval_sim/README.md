# dEval-validator-sim

We propose a decentralized evaluation framework for generative AI models leveraging a validator-based approach. Each validator independently formulates evaluation prompts (original submissions) and executes them across a set of generative models, submitting their recorded performance metrics to a shared database. Subsequently, other validators cross-validate these prompts by independently running identical evaluations, with the outcomes used to corroborate or dispute the original results. Evaluations are aggregated through credibility-weighted averages, dynamically adjusting validators' credibility scores based on consistency between original submissions and corresponding cross-validation outcomes. A change in any validator’s credibility score retroactively influences all previous evaluations involving that validator, ensuring continuous refinement of model assessment accuracy.

## Mathematical Framework

# Mathematical Framework for Decentralized Evaluation Simulation

This document outlines the mathematical framework describing the operation of the validator simulation.

**1. Definitions and Notation**

* **Validators:** Let $V$ be the set of validators, indexed by $i$ or $j$. $V = \{0, 1, ..., N-1\}$, where $N = |V|$ is the total number of validators ($N=8$ in the simulation).
* **Models:** Let $\mathcal{M}$ be the set of generative AI models being evaluated, indexed by $m$. $\mathcal{M} = \{\text{Model}_A, \text{Model}_B, ...\}$. Let $M = |\mathcal{M}|$ be the number of models.
* **Time Steps:** Let $t$ denote the discrete time step or simulation round, $t = 0, 1, 2, ...$.
* **Tests/Prompts:** Let $k$ denote a unique test instance (prompt and evaluation criteria). We assume a new test $k(t)$ is generated at each step $t \ge 1$.
* **Credibility Score:** Let $C_i(t)$ be the credibility score of validator $i$ at the end of step $t$. $C_i(t) \in [C_{min}, C_{max}]$ (e.g., $[0.01, 1.0]$).
* **"True" Score:** Let $T_{k,m}$ be the theoretical "true" performance score of model $m$ on test $k$. $T_{k,m} \in [0, 1]$. This exists only in the simulation.
* **Submitted Score:** Let $S_{i,k,m}$ be the score submitted by validator $i$ for model $m$ on test $k$. $S_{i,k,m} \in [0, 1]$.
* **Submission Type:** Let $\tau_s$ denote the type of a submission $s$, where $\tau_s \in \{\text{original}, \text{cross}\}$.
* **Bad Actor Status:** Let $B_i$ be a boolean indicator, $B_i = 1$ if validator $i$ is a bad actor, $B_i = 0$ otherwise.
* **Bad Actor Bias Function:** Let $\beta(i, m, \tau_s)$ be the bias introduced by validator $i$ for model $m$ during submission type $\tau_s$.
    * $\beta(i, m, \text{original}) > 0$ if $B_i=1$ and $m$ is the target model.
    * $\beta(i, m, \text{original}) < 0$ if $B_i=1$ and $m$ is the victim model.
    * $\beta(i, m, \text{original}) = 0$ if $B_i=0$.
    * $\beta(i, m, \text{cross}) = 0$ for all $i, m$ (as per simulation rules).
* **Noise Function:** Let $\eta_{i,k,m}$ be a random noise term (e.g., drawn from $\mathcal{N}(0, \sigma^2)$), representing honest scoring variations.
* **Results Store:** Let $R(t)$ be the set of all submissions recorded up to the end of step $t$. Each submission $s \in R(t)$ contains $(i_s, k_s, m_s, S_s, \tau_s, O_s, t_s)$ representing (submitter ID, test ID, model ID, score, submission type, original validator ID for test $k_s$, submission step).
* **Originating Validator:** Let $O(t) \in V$ be the index of the validator who originates the test $k(t)$ at step $t$. (e.g., $O(t) = (t-1) \pmod N$).
* **Cross-Validating Set:** Let $XVal(t)$ be the set of validators performing cross-validation at step $t$. $XVal(t) = V \setminus \{O(t)\}$.

**2. Simulation Dynamics**

* **Initialization (t=0):**
    * Set initial credibility $C_i(0) = C_{init}$ for all $i \in V$.
    * Initialize the results store $R(0) = \emptyset$.
    * Initialize final model scores $F_m(0)$ (e.g., $0.5$) for all $m \in \mathcal{M}$.

* **Simulation Step $t$ (for $t \ge 1$):**

    * **Step 2.1: Test Generation & Origination**
        * Select originator $O(t) \in V$.
        * Generate new test $k(t)$.
        * Determine "true" scores $\{T_{k(t),m}\}_{m \in \mathcal{M}}$.

    * **Step 2.2: Score Submission (Original)**
        * Validator $O(t)$ calculates scores for all models $m \in \mathcal{M}$:
            * $S_{O(t), k(t), m} = \text{clamp}( T_{k(t),m} + \beta(O(t), m, \text{original}) + \eta_{O(t),k(t),m}, 0, 1 )$

            where $\text{clamp}(x, a, b) = \max(a, \min(x, b))$.
        * Add original submissions $s_{orig} = (O(t), k(t), m, S_{O(t),k(t),m}, \text{original}, O(t), t)$ for each $m$ to $R(t-1)$ to form intermediate store $R'(t)$.

    * **Step 2.3: Score Submission (Cross-Validation)**
        * For each cross-validator $j \in XVal(t)$:
            * Validator $j$ calculates scores for all models $m \in \mathcal{M}$:
               * $S_{j, k(t), m} = \text{clamp}( T_{k(t),m} + \beta(j, m, \text{cross}) + \eta_{j,k(t),m}, 0, 1 )$
                 (Note: $\beta(j, m, \text{cross}) = 0$).
            * Add cross-validation submissions $s_{cross,j} = (j, k(t), m, S_{j,k(t),m}, \text{cross}, O(t), t)$ for each $m$ to $R'(t)$ to form the full results store $R(t)$.

    * **Step 2.4: Calculate Weighted Mean of Cross-Validations**
        * For the current test $k(t)$ and each model $m \in \mathcal{M}$:
            * Retrieve cross-validation scores $\{S_{j,k(t),m} | j \in XVal(t)\}$ and previous credibilities $\{C_j(t-1) | j \in XVal(t)\}$.
            * Calculate the weighted mean $WMean_{k(t),m}$:
               * $\text{Numerator} = \sum_{j \in XVal(t)} S_{j,k(t),m} \cdot C_j(t-1)$
               * $\text{Denominator} = \sum_{j \in XVal(t)} C_j(t-1)$
               * $WMean_{k(t),m} = \frac{\text{Numerator}}{\max(\text{Denominator}, \epsilon)}$
                 (where $\epsilon$ is a small positive constant, e.g., $10^{-9}$).

    * **Step 2.5: Calculate Discrepancy for Originator**
        * Retrieve the original scores $S_{O(t),k(t),m}$ for test $k(t)$.
        * Calculate a discrepancy measure, $\Delta_{O(t), k(t)}$. Example: Average Absolute Difference:
            * $\Delta_{O(t), k(t)} = \frac{1}{M} \sum_{m \in \mathcal{M}} | S_{O(t),k(t),m} - WMean_{k(t),m} |$

    * **Step 2.6: Update Credibility Scores**
        * Define a credibility update function $f(\Delta, C_{old})$. Example using learning rate $L$ and penalty factor $P$:
           * $\text{Change} = L \cdot (1 - P \cdot \Delta)$
           * $C^1_{O(t)}(t) = C_{O(t)}(t-1) + \text{Change}$
           * $C_{O(t)}(t) = \text{clamp}( C^1_{O(t)}(t), C_{min}, C_{max} )$

        * For all other validators $j \neq O(t)$:
           * $C_j(t) = C_j(t-1)$

    * **Step 2.7: Recalculate Final Model Scores (Retroactive)**
        * For each model $m \in \mathcal{M}$:
            * Initialize $Num_m = 0$, $Denom_m = 0$.
            * Iterate through *all* submissions $s = (i_s, k_s, m_s, S_s, \tau_s, O_s, t_s)$ in the *entire history* $R(t)$.
            * If $m_s = m$:
                * Retrieve the *current* credibility $C_{i_s}(t)$ for the submitter $i_s$.
                * $Num_m = Num_m + S_s \cdot C_{i_s}(t)$
                * $Denom_m = Denom_m + C_{i_s}(t)$
            * Calculate the final score for model $m$ at step $t$:
                * $F_m(t) = \frac{Num_m}{\max(Denom_m, \epsilon)}$

**3. Goal Demonstration**

The framework shows that if a bad actor validator $i$ (where $B_i=1$) consistently submits biased scores $S_{i,k,m}$ during its origination steps (Step 2.2), the discrepancy $\Delta_{i, k(t)}$ (Step 2.5) will likely be larger compared to honest validators. This leads to repeated negative credibility updates (Step 2.6), causing $C_i(t)$ to decrease. Consequently, in the final score calculation (Step 2.7), the contribution of validator $i$'s submissions ($S_s$ where $i_s = i$) is down-weighted by the low $C_i(t)$, reducing the bad actor's influence on the final model scores $F_m(t)$.
