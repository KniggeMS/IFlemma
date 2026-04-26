## Agentic Memory: Learning Unified Long-Term and Short-Term Memory

## Management for Large Language Model Agents

## Yi Yu1,2, Liuyi Yao1,†, Yuexiang Xie^1 , Qingquan Tan^2 , Jiaqi Feng^2 ,

## Yaliang Li^1 , and Libing Wu2,†

(^1) Alibaba Group,
(^2) School of Cyber Science and Engineering, Wuhan University
{yui1212,tanqingquan,jiaqiFeng,wu}@whu.edu.cn
{yly287738,yuexiang.xyx,yaliang.li}@alibaba-inc.com
†Corresponding authors

## Abstract

```
Large language model (LLM) agents face fun-
damental limitations in long-horizon reason-
ing due to finite context windows, making ef-
fective memory management critical. Exist-
ing methods typically handle long-term mem-
ory (LTM) and short-term memory (STM) as
separate components, relying on heuristics or
auxiliary controllers, which limits adaptabil-
ity and end-to-end optimization. In this pa-
per, we propose Agentic Memory (AgeMem),
a unified framework that integrates LTM and
STM management directly into the agent’s pol-
icy. AgeMem exposes memory operations as
tool-based actions, enabling the LLM agent to
autonomously decide what and when to store,
retrieve, update, summarize, or discard infor-
mation. To train such unified behaviors, we pro-
pose a three-stage progressive reinforcement
learning strategy and design a step-wise GRPO
to address sparse and discontinuous rewards
induced by memory operations. Experiments
on five long-horizon benchmarks demonstrate
that AgeMem consistently outperforms strong
memory-augmented baselines across multiple
LLM backbones, achieving improved task per-
formance, higher-quality long-term memory,
and more efficient context usage.
```
## 1 Introduction

```
In long-horizon agentic tasks involving multi-step
reasoning and complex workflows (Chang et al.,
2024), the effectiveness of large language model
(LLM) agents is fundamentally constrained by the
information they can attend to at any given time,
which we collectively refer to as the agent’s mem-
ory (Xiong et al., 2025; Goodyear et al., 2025).
Memory typically falls into two categories: long-
term memory (LTM), which persistently stores
user- or task-specific knowledge (Zhong et al.,
2024; Jiang et al., 2024), and short-term memory
(STM), which comprises the information contained
in the current input context (Wu et al., 2025b; Gao
```
```
et al., 2025b). High-quality LTM supports efficient
retrieval of accumulated knowledge, while effec-
tive STM management reduces redundancy and
preserves salient context. Together, they mitigate
the limitations of finite context windows, making
their joint management crucial for improving agent
performance in complex reasoning settings.
However, existing research has predominantly
treated LTM and STM as independent components.
STM is commonly enhanced through retrieval-
augmented generation (RAG) (Pan et al., 2025b),
such as in MainRAG (Chang et al., 2025) and
ReSum (Wu et al., 2025a), which expand usable
context via external retrieval or periodic summa-
rization. Although effective in some tasks, these
methods rely heavily on predefined schedules or
heuristic rules, potentially resulting in overlooked
infrequent but critical details as well as unneces-
sary noise (Ma et al., 2025; Dong et al., 2025). In
contrast, LTM management has progressed along
separate lines, typically categorized into trigger-
based (Kang et al., 2025; Wang and Chen, 2025;
Wang et al., 2025c; Chhikara et al., 2025) and
agent-based (Yan et al., 2025; Hu et al., 2025;
Xu et al., 2025) paradigms. The former executes
fixed memory operations at predefined moments,
whereas the latter incorporates a specialized mem-
ory manager to determine what and how to store.
Despite offering more flexibility, most approaches
still depend on handcrafted rules or auxiliary ex-
pert models, limiting adaptability and increasing
system complexity (Xiong et al., 2025).
As a consequence, LTM and STM are typically
treated as separate and loosely coupled modules.
As illustrated in Figure 1, existing architectures
generally follow two patterns: (a) static STM with
trigger-based LTM, or (b) static STM with agent-
based LTM. In both settings, the two memory sys-
tems are optimized independently and later com-
bined in an ad hoc way, leading to fragmented
memory construction and suboptimal performance
```
# arXiv:2601.01885v1 [cs.CL] 5 Jan 2026


```
Query
moWreh micehm^ bbaenrds^ ,h Masu^ se
or The Raconteurs?
```
```
Session
1. Narci C ss o us n ( t b e a n nd t ) ...
23 .. TShuend Raaec Conlutbe u..r.s ...
```
```
Short-tSertamti Mc^ emory
Query
RMeetmrieovrieeds
```
```
LonTgri-gtegremr- bMaseemdo^ ry
mAemddory
mUepmdaotrey
mDeemleotrey
```
```
Msteomraogrey
```
```
Mreetrmieovrayl
```
```
ALnLswMe^ r
<Tahnse wRearc>onteurs.
</answer>
```
```
Context
```
```
ShMoertm-toerrym LMonegm-toerrym
```
```
Icnodnesptreuncdteionnt
```
```
Mruesltpi-ornosuensd
```
```
Query
moWreh micehm^ bbaenrds^ ,h Masu^ se
or The Raconteurs?
```
```
Session
1. Narci C ss o us n ( t b e a n nd t ) ...
23 .. TShuend Raaec Conlutbe u..r.s ...
```
```
Short-tSertamti Mc^ emory
Query
MReetmrieovreieds^
```
```
Agteenrtm-b Maseedm Loroyng-
```
```
ALnLswMe^ r
<Tahnes wRearc>onteurs.
</answer>
```
```
Context
```
```
ShMoertm-toerrym LMonegm-toerrym
```
```
Icnodnesptreuncdteionnt
```
```
Mruelstpi-ornosuensd
```
```
Memory
<operat M ion a > nager
{e“natc”t:i”oNna”r:”caidssdu”s,“ c..o.”n}t
</operation>
oMpeermaotiroyn^
```
```
Msteomraogrey
```
```
Mretermieovrayl
```
```
Query
moWreh micehm^ bbaenrds^ ,h Masu^ se
or The Raconteurs?
```
```
Session
1. Narc C iss o us n ( t b e a n nd t ) ...
```
23 .. TShuen (^) dRaaec oCnlutbeu ..r.s ...
**Agentic Memory Management**
**_MTeomoolsr_**^ **_cy aolplienrga_**^ **_t&io_**^ **_n
MSehmoorrt-yt eTromo_**^ **_ls MLeomnogr-yt_**^ **_eTromo_**^ **_ls_**
**Agentic Context Agentic Memory
ALnLswMe**^ **r**
<Tahnesw Rearc>onteurs.
</answer>
**_Mruesltpi-ornosuensd
reMtrieemvaolr tyo_**^ **_ol_**
**LMonegm-toerrmy**
**_coAnsgternuctitcion_**
**ShMoretm-toerrym**
(a) Static STM + Trigger-based LTM (b) Static STM + Agent-based LTM (c) Unified Management (AgeMem)
Figure 1: Comparison between independent and unified memory management frameworks. (Left) Traditional
framework with static STM and trigger-based LTM. (Middle) Independent framework with an additional Memory
Manager controlling LTM in an agent-based manner, while STM remains static. (Right) The proposed AgeMem
framework, where LTM and STM are jointly and intelligently managed via explicit tool-based operations.
in long-horizon reasoning tasks. Thus, unifying the
management of LTM and STM remains a necessary
yet largely unexplored challenge.
Nevertheless, achieving unified memory man-
agement poses three fundamental challenges. (C1)
Functional heterogeneity coordination: LTM
and STM serve distinct yet complementary pur-
poses: LTM determines what to store, update, or
discard, while STM governs what to retrieve, sum-
marize, or remove from the active context (Zhang
et al., 2025b). The challenge lies in designing
a unified mechanism that orchestrates their inter-
play synergistically. (C2) Training paradigm
mismatch: Existing reinforcement learning (RL)
frameworks adopt markedly different training
strategies for the two memory types (Ma et al.,
2024). LTM-focused training often leverages
session-level information available prior to interac-
tion, whereas STM training typically injects distrac-
tors to simulate long-horizon contexts (Sun et al.,
2024). Moreover, standard RL assumes continuous
trajectories with stable rewards, which conflicts
with the inherently fragmented and discontinuous
experiences produced by memory operations (Wu
et al., 2025a), making end-to-end optimization par-
ticularly challenging. (C3) Practical deployment
constraints: Many agent systems rely on an auxil-
iary expert LLM for memory control, significantly
increasing inference cost and training complexity.
How to integrate unified memory management di-
rectly into an agent without dependence on external
expert models remains an open problem.
To address these challenges, we propose Agen-
tic Memory (AgeMem), a unified framework that
jointly manages LTM and STM, illustrated in
Figure 1 (right). Unlike prior designs that treat
memory as an external component, AgeMem inte-
grates both memory types directly into the agent’s
decision-making process. Through a unified tool-
based interface, the LLM autonomously invokes
and executes memory operations for both LTM
and STM. Furthermore, we design a three-stage
progressive RL strategy: the model first acquires
LTM storage capabilities, then learns STM con-
text management, and finally coordinates both
forms of memory under full task settings. To
address the fragmented experience issue across
training stages, we design a step-wise Group Rel-
ative Policy Optimization (GRPO) (Shao et al.,
2024), which transforms cross-stage dependencies
into learnable signals, thereby alleviating the chal-
lenges posed by sparse and discontinuous rewards
in RL. We evaluate AgeMem on five long-context,
reasoning-intensive benchmarks. Comprehensive
results show that AgeMem consistently outper-
forms strong baselines, validating the effectiveness
of unified memory management.
Our main contributions are as follows:

- We propose Agentic Memory (AgeMem), a
    unified agentic memory framework that en-
    ables LLM-based agents to autonomously decide
    when, what, and how to manage both long-term
    and short-term memory.
- We develop a three-stage progressive RL strat-


```
egy equipped with a step-wise GRPO mecha-
nism, facilitating effective end-to-end learning of
unified memory management behaviors.
```
- We conduct comprehensive evaluations across
    multiple models and long-horizon benchmarks,
    demonstrating the robustness and effectiveness
    of AgeMem in complex agentic tasks.

## 2 Background and Related Work

Long-term memory (LTM). Persistent LTM is
crucial for LLM-based agents operating over ex-
tended horizons (Wang et al., 2025b; Li et al.,
2025). Recent work has explored diverse ar-
chitectural designs for modeling LTM. Lang-
Mem (LangChain Team, 2025) provides a mod-
ular framework that supports multiple memory
types, while A-Mem (Xu et al., 2025) adopts
a Zettelkasten-inspired design that links struc-
tured knowledge units to facilitate consolidation.
Mem0 (Chhikara et al., 2025) proposes a scal-
able extract-update pipeline and extends it to a
graph-based variant for structured reasoning, and
Zep (Rasmussen et al., 2025) represents memory
as a temporal knowledge graph to enable cross-
session and time-aware reasoning. Although ef-
fective in organizing and retrieving information,
these approaches largely rely on predefined mem-
ory structures or heuristic update rules. As mem-
ory grows, such designs commonly suffer from
increased system complexity and lack adaptive,
learning-based strategies for prioritization and for-
getting. In contrast, our work aims to learn an
adaptive memory policy that allows agents to dy-
namically decide what to store, update, or forget,
depending on task demands and long-term utility.
Short-term memory (STM). STM in agentic
LLMs primarily concerns context selection and
retrieval (Wang et al., 2024; Jin et al., 2024).
Retrieval-Augmented Generation (RAG) (Pan et al.,
2025b; Salama et al., 2025; Kagaya et al., 2024)
is the dominant paradigm, expanding usable con-
text by injecting retrieved content into prompts.
While effective, RAG does not fundamentally pre-
vent context explosion in long-horizon settings and
may introduce irrelevant or distracting information.
To address this issue, ReSum (Wu et al., 2025a)
periodically compresses interaction histories into
compact reasoning states, allowing agents to oper-
ate beyond fixed context-window constraints. Yet
its summarization schedule remains largely prede-
fined, and aggressive compression risks discarding

```
rare but crucial details. Our approach instead en-
ables agents to learn when and how to retrieve,
summarize, or filter context, achieving a more flex-
ible balance between efficiency and information
preservation.
Reinforcement learning for LLMs. Reinforce-
ment learning has become an effective paradigm
for improving the decision-making and reasoning
capabilities of LLM-based agents (Yao et al., 2022;
Jin et al., 2025; Qian et al., 2025; Chaudhari et al.,
2025). Among recent advances, GRPO (Shao et al.,
2024) enhances stability by optimizing policies
based on the relative quality of sampled trajectories,
removing the need for an explicit value function.
GRPO and its variants (Gilabert et al., 2025; Wang
et al., 2025a) have shown strong performance in
complex reasoning tasks. However, existing RL-
based systems generally treat memory as a static
or external component, making them ill-suited for
the discontinuous and fragmented trajectories asso-
ciated with memory operations (Yan et al., 2025;
Zhang et al., 2025a). In contrast, our work inte-
grates RL directly into the memory management
process, enabling unified training of both language
generation and memory operations.
```
## 3 Method

```
We propose Agentic Memory (AgeMem), a uni-
fied memory framework that enables LLM agents
to autonomously manage both LTM and STM in
an end-to-end manner. As illustrated in Figure 1
(right), AgeMem integrates memory management
capabilities directly into the agent via a set of spe-
cialized tools, enabling the model to learn optimal
strategies for unified memory management through
three-stage progressive strategy.
```
```
3.1 Problem Formulation
Unified RL formulation for AgeMem. At each
time stept, the agent observes a statest∈Scom-
posed of the conversation context (short-term mem-
ory)Ct, the long-term memory storeMt, and the
task specificationT:st= (Ct,Mt,T ). The spec-
ificationT includes the input queryq, contextual
informationIq, and (for training only) the expected
answerAq. This formulation enables the agent to
ground its decision-making in both transient con-
text and persistent knowledge.
Givenst, the agent selects an actionat ∈ A
from a hybrid action space that includes language
generation as well as memory operations. The de-
```

```
cision is governed by a parameterized policyπθ,
defined asπθ(at|st) = P (at|st;θ), whereθde-
notes the LLM parameters andat= πθ(·|st). For
a trajectoryτ = (s 1 ,a 1 ,...,sT,aT), the cumula-
tive reward is defined as:
```
```
R(τ ) =
```
### X

```
wi· Ri(τ ) + Ppenalty(τ ), (1)
```
whereRicaptures task performance and memory
quality, andPpenaltydiscourages redundant storage,
excessive tool usage, and uncontrolled context ex-
pansion. The optimization objective is:

```
θ∗= arg max
θ
```
```
Eτ∼πθ[R(τ )]. (2)
```
This formulation treats memory management as an
integral component of the agent’s policy, replacing
handcrafted heuristics with a learnable mechanism.
Three-stage trajectory structure. To capture
long-horizon interactions and progressively train
memory capabilities, each trajectory is divided into
three consecutive stages: τ = (τ(1),τ(2),τ(3)),
with a total length ofT = T 1 +T 2 +T 3. In Stage 1,
the agent engages in casual interactions and may
store useful information into LTM. Stage 2 intro-
duces distracting or irrelevant content, requiring
the agent to manage its STM through selective re-
tention and compression. Stage 3 presents a task
that depends on coordinated use of both retained
context and earlier accumulated LTM. A key aspect
of this design is that the long-term memoryMtper-
sists across all stages, allowing early knowledge to
influence later decisions. In contrast, the context
Ctis reset between Stages 1 and 2 to prevent in-
formation leakage across phases. The reset before
Stage 2 ensures the agent cannot solve the final
task via residual context, thereby forcing proper
retrieval from LTM and enabling effective training
of memory operations.
At each step, we collect an experience tuple
et = (st,at,rt, logπθold(at|st)), wherertis typ-
ically zero for intermediate steps and assigned af-
ter trajectory completion, andlogπθold(at|st)de-
notes thelogprobability under the old policyπθold.
This representation enables step-wise credit assign-
ment under GRPO (Shao et al., 2024) and allows
the agent to attribute long-term rewards to specific
memory decisions across stages. By structuring tra-
jectories in this staged yet continuous manner, the
agent learns temporally coherent and task-adaptive
memory policies essential for robust long-horizon
reasoning.

```
Table 1: Memory management tools in AgeMem for
manipulating long-term memory (LTM) and short-term
memory (STM).
```
```
Tool Target Function
ADD LTM Add new knowledge toMt
UPDATE LTM Modify entries inMt
DELETE LTM Remove entries fromMt
RETRIEVE STM Retrieve entries fromMtto Ct
SUMMARY STM Summarize segments in Ct
FILTER STM Filter out irrelevant segments from Ct
```
```
3.2 Memory Management via Tool Interface
AgeMem exposes memory-related operations to the
LLM agent through an explicit tool interface (Ta-
ble 1). The agent can modify its persistent LTM us-
ing ADD, UPDATE, and DELETE, while exercising
fine-grained control over STM through RETRIEVE,
SUMMARY, and FILTER. Incorporating these tools
into the action space transforms memory control
from an external heuristic pipeline into an intrinsic
component of decision-making. This design allows
the agent to adaptively manage memory according
to task structure, history, and context. Implementa-
tion details are provided in the Appendix A.1.
```
```
3.3 Three-Stage Progressive RL Strategy
To learn unified and stable memory behaviors, we
propose a progressive three-stage training strategy.
For each task instanceq ∈T, the agent generates
a complete trajectory:
```
```
τk(q)=
```
### 

```
τk(1), τk(2), τk(3)
```
### 

```
, k = 1,...,K, (3)
```
```
whereKdenotes the number of independent roll-
outs, and each sub-trajectory τk(i)corresponds to a
specific training stage.
Stage 1 (LTM construction). The agent is ex-
posed to contextual informationIqin a casual con-
versational setting. The goal is to identify salient
information and store it into LTMMt. During the
interaction, the short-term contextCtevolves natu-
rally, and the agent may invoke LTM-related tools
when appropriate. Formally, this stage yields a sub-
trajectoryτk(1)={et}Tt=1^1 , where each experience
tuple etfollows the definition in Section 3.1.
Stage 2 (STM control under distractors). The
short-term context is reset, while the constructed
LTMMtis retained. The agent is then presented
with semantically related but irrelevant or mislead-
ing distractors. The objective is to learn proac-
tive STM control through tool-based operations,
```

```
such as filtering or summarizing context, in or-
der to suppress noise and preserve useful infor-
mation. This process forms the sub-trajectory
τk(2)={et}Tt=^1 +T 1 T+1^2 , which emphasizes context fil-
tering and compression capability.
Stage 3 (Integrated reasoning and memory co-
ordination). Finally, the agent receives a formal
queryqrequiring both accurate reasoning and ef-
fective memory retrieval. The agent must retrieve
relevant knowledge fromMt, appropriately man-
age the contextCt, and generate a final answer.
This stage produces τk(3)={et}Tt=T 1 +T 2 +1, which
evaluates the ability of agent to coordinate long-
term memory, short-term context management, and
task solution in an end-to-end manner.
All three segments form a complete trajectory:
```
```
τk(q)= (e 1 ,e 2 ,...,eT), T = T 1 +T 2 +T 3 , (4)
```
which is then used for policy optimization in the
subsequent step-wise GRPO procedure. For a batch
ofBtasks, we further aggregate all experiences
fromKindependent rollouts into a unified setE =
SB
q=

### SK

```
k=1{et| et∈ τ
```
```
(q)
k }, with a total size of
|E| = B× K ×T ̄, whereT ̄denotes the average
trajectory length. More detailed rollout processes
are provided in the Appendix A.3.
```
```
3.4 Step-wise GRPO for Unified Management
```
We adopt a step-wise variant of GRPO to con-
nect long-range task rewards with memory de-
cisions across all stages. For taskq, letGq =
{τ 1 (q),...,τK(q)}denote the group of parallel roll-
outs. Each trajectory yields a terminal reward
r(Tk,q) = R(τk(q)). We compute the group-
normalized advantage for the terminal step as:

```
A(Tk,q)=
```
```
r(Tk,q)− μGq
σGq+ ε
```
### , (5)

whereμGqandσGqare the mean and standard de-
viation of rewards withinGq,εprevents division
by zero. This advantage is then broadcast to all pre-
ceding steps of the same trajectoryA(tk,q)= A(Tk,q),
which assigns a consistent learning signal to all
memory and reasoning actions along the trajectory,
including those in Stage 1 and Stage 2. In do-
ing so, the final task outcome supervises every in-
termediate memory decision, enabling long-range
credit assignment across heterogeneous stages. We
then augment the experience set with advantages,
E =

### SB,K

```
q,k {(et,At)|et∈ τ
```
```
(q)
k ,At= A
```
```
(k,q)
t }.
```
```
Following GRPO, we maximize the expected
objective over all experiences:
```
```
J (θ) =E(et,At)∼E
```
### 

```
ρtAt− βDKL[πθ∥πref]
```
### 

### =

### 1

### |E|

### XB

```
q=
```
### XK

```
k=
```
```
TXk(q)
```
```
t=
```
### 

```
ρ(tk,q)A(tk,q)− βD(KLk,q)
```
### 

### ,

### (6)

```
where the importance ratioρ(tk,q)=ππθθ(at|st)
old(at|st)
con-
trols the update magnitude under the new policy,
D(KLk,q)denotes the KL divergence penalty between
the current policyπθand a fixed referenceπref,
andβis a coefficient that balances exploration and
training stability.
```
```
3.5 Reward Function Design
We design a composite reward that evaluates both
downstream task performance and the quality of
memory management. The total trajectory-level
reward is defined as
```
```
R(τ ) = w⊤R + Ppenalty, (7)
```
```
wherew = [wtask,wcontext,wmemory]⊤are tunable
coefficients, andR = [Rtask,Rcontext,Rmemory]⊤
correspond to rewards for task completion, context
management, and long-term memory management.
The penalty termPpenaltycaptures violations such
as context overflow or exceeding the interaction
limit. Below, we summarize each component, and
precise formulas are provided in the Appendix A.2.
Task completion rewardRtask. This term pro-
vides the primary learning signal by assessing
whether the agent solves the task correctly. We
obtain a scalar score using an LLM-based judge
Sjudge(Apred,Aq) ∈ [0, 1], optionally applying a
penalty when no answer is produced. This reward
encourages accurate, complete task solutions and
remains the dominant component to ensure align-
ment with task objectives.
Context management rewardRcontext. This com-
ponent evaluates STM behavior, focusing on how
effectively the agent controls the active context
Ct. It combines three factors: (i) compression ef-
ficiency, promoting economical token usage; (ii)
preventive actions, rewarding early summarization
or filtering to avoid overflow; and (iii) information
preservation, penalizing the loss of critical query-
related content. Each factor is normalized, allowing
the reward to balance context efficiency against re-
tention of essential information.
Memory management rewardRmemory. This
```

```
term evaluates LTM operations. It aggregates sig-
nals for: (i) storage quality, measured as the frac-
tion of stored entries labeled as high-quality and
reusable; (ii) maintenance, rewarding meaningful
update or delete operations to mitigate memory stal-
eness; and (iii) semantic relevance, computed using
an LLM-based score between retrieved memories
and the query. Together, these signals incentivize
selective, high-value memory construction and re-
sponsible upkeep over time.
Penalty termsPpenalty. Penalties discourage unde-
sirable behaviors such as exceeding the maximum
number of dialogue turns or triggering context over-
flow. Penalty coefficients are chosen so that such
violations lead to a substantial reduction in the final
trajectory reward, encouraging the agent to main-
tain safe and efficient memory practices.
```
## 4 Experiments

4.1 Experimental Setup
Datasets. To comprehensively evaluate AgeMem,
we select five widely-used datasets in LLM-based
agent research: ALFWorld (Shridhar et al., 2020),
SciWorld (Wang et al., 2022), PDDL (Chang et al.,
2024), BabyAI (Chevalier-Boisvert et al., 2018),
and HotpotQA (Yang et al., 2018). These datasets
cover embodied action, game-based reasoning, and
knowledge-intensive question answering, provid-
ing diverse evaluation scenarios. Since the Hot-
potQA dataset contains both questions and sup-
porting facts, automatically providing Stage 1 con-
textual information, AgeMem is fine-tuned with
RL only on the HotpotQA training set and then
evaluated directly on all datasets. Detailed dataset
statistics are provided in Appendix C.1.
Evaluation metrics. For the primary task com-
pletion metrics, we adopt Success Rate (SR) for
ALFWorld, SciWorld, and BabyAI, Progress Rate
(PR) for PDDL, and LLM-as-a-Judge (J) for Hot-
potQA. Additionally, we employ an LLM-based
evaluator to assess the quality of stored long-term
memory during knowledge reasoning, measured by
Memory Quality (MQ). The prompts of the LLM-
based evaluation are provided in Appendix C.2.
Baselines & LLM backbones. We compare Age-
Mem against four representative agent LTM sys-
tems: LangMem (LangChain Team, 2025), A-
Mem (Xu et al., 2025), Mem0 (Chhikara et al.,
2025), andMem0g(a graph-based variant officially
provided as part of Mem0). To better demonstrate
the effectiveness of RL training, we also include

```
LangMemA-Mem Mem0 Mem0gAgeMem
-noRL
AgeMem
(a) Qwen2.5-7B-Instruct
```
```
0.
```
```
0.
```
```
0.
```
```
0.
```
```
Memory Quality (MQ)
```
```
0.498 0.512 0.
0.
0.
```
```
0.
```
```
Baselines
AgeMem
Avg. Baseline
```
```
LangMemA-Mem Mem0 Mem0gAgeMem
-noRL
AgeMem
(b) Qwen3-4B-Instruct
```
```
0.
```
```
0.
```
```
0.
```
```
0.
```
```
Memory Quality (MQ)
```
```
0.
```
```
0.
0.543 0.
```
```
0.
```
```
0.
```
```
Figure 2: Memory Quality scores for different methods
on HotpotQA. Higher scores indicate better relevance
between stored memories and ground-truth facts.
```
```
AgeMem-noRL, which is not fine-tuned with RL.
In ablation studies on STM, we compare STM tools
with RAG approach. For the base agent models, we
use Qwen2.5-7B-Instruct and Qwen3-4B-Instruct.
More baseline configurations are in Appendix C.3.
Implementation details. We build agents using the
Agentscope framework (Gao et al., 2025a) and fine-
tune AgeMem using the Trinity framework (Pan
et al., 2025a). For all reward weights in the reward
function, we use uniform coefficients of 1.0 with-
out manual tuning. Further implementation details
are provided in Appendix C.4.
```
```
4.2 Main Results
Comparison with counterparts. Table 2 shows
that AgeMem achieves the highest average perfor-
mance on both Qwen2.5-7B-Instruct (41.96%) and
Qwen3-4B-Instruct (54.31%), outperforming all
baselines across five datasets with relative gains
of 49.59% and 23.52% over no-memory, respec-
tively. Compared to the best baselines (Mem0 and
A-Mem), AgeMem improves by 4.82 and 8.57 per-
centage points on average. RL training contributes
8.53 percentage points and 8.72 percentage points
improvements over AgeMem-noRL, validating the
three-stage progressive RL strategy.
Quality of stored long-term memories. To eval-
uate the quality of stored memories, we leverage
the ground-truth facts provided in the HotpotQA
dataset and assess the relevance between stored
memories and these facts using an LLM-based
evaluator. Figure 2 presents the Memory Qual-
ity (MQ) scores for different baselines. AgeMem
```

```
Table 2: Performance comparison across five benchmarks. The best and second-bestresults are marked.
```
```
LLM Backbone Method ALFWorld SciWorld PDDL BabyAI HotpotQA Average
```
```
Qwen2.5-7B-Instruct
```
```
No-Memory 27.16 13.80 10.15 50.80 38.36 28.
LangMem 38.27 28.29 15.85 51.34 37.43 34.
A-Mem 34.68 28.06 18.39 58.82 43.95 36.
Mem0 37.49 26.99 13.96 60.58 46.66 37.
Mem0g 35.34 30.50 14.86 58.78 42.06 36.
AgeMem-noRL 37.90 28.67 8.87 46.34 45.36 33.
AgeMem (Ours) 41.07 35.55 17.31 61.42 54.44 41.
```
```
Qwen3-4B-Instruct
```
```
No-Memory 38.51 47.89 30.14 55.83 47.48 43.
LangMem 40.89 50.42 28.42 53.80 42.70 43.
A-Mem 34.31 50.14 34.41 61.35 48.48 45.
Mem0 41.17 51.38 31.72 60.05 39.16 44.
Mem0g 36.69 47.76 29.61 57.59 38.12 41.
AgeMem-noRL 38.02 50.42 27.52 57.48 54.49 45.
AgeMem (Ours) 48.97 59.48 35.07 72.56 55.49 54.
```
```
0
```
```
2
```
```
4
```
```
6
```
```
Token Reduction(%)
```
```
2.6%2.6%
```
```
4.3%
3.0%
```
```
0.0%0.0%
```
```
3.1%
```
```
5.1%
```
```
Baseline: AgeMem-RAG
```
```
Qwen2.5-7B
Qwen3-4B
```
```
AgeMem-noRL-RAG AgeMem-noRL AgeMem-RAG AgeMem(Ours)
Configuration
```
```
2000
```
```
2250
Avg. Tokens
```
```
2128
2251
2092
```
```
2241 21862310
2117 2191
```
```
Figure 3: Average prompt token counts under different
STM management configurations on HotpotQA. The
suffix “-RAG” indicates the adoption of RAG in place
of STM tool-based management.
```
achieves the highest memory quality on both model
backbones, with MQ scores of 0.533 and 0.605, re-
spectively. This indicates that the unified memory
management framework not only improves task
performance but also promotes the storage of high-
quality, reusable knowledge. The comparison with
baseline methods further validates that AgeMem’s
tool-based memory operations lead to more selec-
tive and higher-quality memory construction.
Effectiveness of STM management. We eval-
uate the effectiveness of STM management by
measuring the prompt token count under different
configurations on HotpotQA. Figure 3 shows that
AgeMem successfully reduces prompt token usage
compared to variants without STM tools (-RAG).
On Qwen2.5-7B-Instruct, AgeMem uses 2,117 to-
kens on average, compared to 2,186 tokens for
AgeMem-RAG, representing a reduction of 3.1%.
On Qwen3-4B-Instruct, the reduction is even more
pronounced: AgeMem uses 2,191 tokens versus
2,310 tokens for AgeMem-RAG, a reduction of
5.1%. These results demonstrate that the learned
STM management tools effectively control con-

```
Table 3: Tool usage statistics on HotpotQA. Numbers
show average calls per episode.
```
```
Tool Category Qwen2.5-7B Qwen3-4B
noRL GRPO noRL GRPO
LTM Tool Statistics
ADD Memory 0.92 1.64 2.49 2.
UPDATE Memory 0.00 0.13 0.13 0.
DELETE Memory 0.00 0.08 0.00 0.
STM Tool Statistics
RETRIEVE Memory 2.31 1.95 4.62 4.
SUMMARY Context 1.08 0.82 0.11 0.
FILTER Context 0.02 0.31 0.15 0.
Total Calls 4.33 4.92 7.50 8.
```
```
text expansion, enabling more efficient token usage
while maintaining task performance.
Tool usage analysis. Table 3 reports tool usage
statistics before and after RL fine-tuning on Hot-
potQA. RL training substantially increases the use
of long-term memory tools, especially ADD and
UPDATE. On Qwen2.5-7B-Instruct, ADD opera-
tions rise from 0.92 to 1.64, and UPDATE opera-
tions appear after training (0.13 v.s. nearly zero).
Similar trends are observed on Qwen3-4B-Instruct,
with higher frequencies of both ADD and UP-
DATE. For short-term memory tools, RL leads
to more balanced tool usage. The frequency of
FILTER increases notably (e.g., from 0.02 to 0.
on Qwen2.5), indicating proactive context control,
while RETRIEVE remains relatively stable. Overall,
these patterns suggest that RL training enables co-
ordinated and adaptive memory management. De-
tailed case studies are provided in Appendix B.
```
```
4.3 Ablation Studies
LTM-STM components. To validate the con-
tributions of individual components, we conduct
```

```
Base +LT +LT/RL+LT/ST/RL
(a) ALFWorld
```
```
0
```
```
20
```
```
40
```
```
60
```
```
Performance Score
```
```
27.
```
```
37.
+10.
```
```
38.
+11.
```
```
41.
+13.
```
```
Base +LT +LT/RL+LT/ST/RL
(b) SciWorld
```
```
0
```
```
20
```
```
40
```
```
60
```
```
13.
```
```
27.
+14.
```
```
32.
+18.
```
```
35.
+21.
```
```
Base +LT +LT/RL+LT/ST/RL
(c) HotpotQA
```
```
0
```
```
20
```
```
40
```
```
60
38.
45.
+7.
```
```
52.
+13.
```
```
54.
+16.
```
Figure 4: Ablation study on LTM, STM, and RL components (Qwen2.5-7B-Instruct). Base: No-memory baseline;
+LT: AgeMem-noRL-RAG (LTM tools only); +LT/RL: AgeMem-RAG (RL with LTM tools); +LT/ST/RL:
AgeMem (full AgeMem system with RL). Green arrows indicate performance gains over the baseline.

ablation studies on LTM, STM, and RL training.
Figure 4 presents results on three representative
datasets using Qwen2.5-7B-Instruct as the back-
bone (results for Qwen3-4B-Instruct are provided
in Appendix D.1). Adding LTM alone (+LT)
yields substantial gains of +10.6%, +14.2%, and
+7.4% over the baseline. Incorporating RL training
(+LT/RL) further improves performance, particu-
larly on HotpotQA (+6.3%), demonstrating the ef-
fectiveness of our reward-based optimization. The
full AgeMem system (+LT/ST/RL) achieves the
best results across all benchmarks, with overall
improvements of +13.9%, +21.7%, and +16.1%.
Notably, adding STM tools provides the most
significant boost on SciWorld (+3.1%) and Hot-
potQA (+2.4%), validating that learned context
management outperforms static RAG approaches.
These progressive improvements confirm that uni-
fied memory management with end-to-end RL is
essential for optimal agent performance.
Reward function. To demonstrate the effective-
ness of our multi-component reward function de-
sign, we compare the full reward function (All-
Returns) against a variant using onlyRtask(Answer-
Only). Figure 5 shows the reward convergence
curves of Qwen2.5-7B-Instruct during GRPO train-
ing on HotpotQA. The full reward function leads
to significantly faster convergence and higher fi-
nal performance compared to the task-only variant.
As detailed in Table 4, the All-Returns strategy
achieves higher LLM-as-a-Judge scores (0.544 v.s.
0.509) while maintaining substantially better mem-
ory quality (0.533 v.s. 0.479). Notably, despite us-
ing more tokens (2117 v.s. 2078), the All-Returns
strategy achieves better overall performance, in-
dicating that the additional context and memory
operations contribute meaningfully to reasoning
quality. Similar patterns are observed on Qwen3-
4B-Instruct (see Appendix D.2).

0.0 (^02040) Training Step 60 80 100
0.
0.
0.
0.
1.
Average Reward
**Qwen2.5-7B - GRPO Training Reward Convergence**
All Returns
Answer-Only
Figure 5: Training convergence curves on Qwen2.5-7B-
Instruct comparing All-Returns (solid line) v.s. Answer-
Only (dashed line) reward strategies.
Table 4: Reward function ablation on HotpotQA using
Qwen2.5-7B-Instruct. All-Returns v.s. Answer-Only
reward strategies. “TN” is the token number, and “TC”
denotes the number of tool calls.
Strategy J(↑) TN(↓) MQ(↑) TC(-)
Answer-Only 0.509 2078 0.479 3.
All-Returns 0.544 2117 0.533 4.

## 5 Conclusion

```
In this work, we propose Agentic Memory (Age-
Mem), a unified memory management framework
that enables LLM-based agents to jointly control
long-term and short-term memory through learn-
able, tool-based actions. By integrating memory
operations directly into the agent’s policy and train-
ing them with a progressive reinforcement learn-
ing strategy, AgeMem replaces heuristic memory
pipelines with an end-to-end optimized solution.
Extensive experiments across diverse long-horizon
benchmarks show that AgeMem improves both task
performance and memory quality while maintain-
ing efficient context usage. These results highlight
the importance of unified, agent-centric memory
policies and suggest a promising direction for build-
ing scalable and adaptive LLM agents capable of
long-term reasoning.
```

## Limitations

While AgeMem demonstrates strong performance
across multiple settings, there remain opportunities
for further extension. The current implementation
adopts a fixed set of memory management tools,
which provides a clear and effective abstraction but
could be extended to support more fine-grained con-
trol in future work. In addition, although we eval-
uate our approach on several representative long-
horizon benchmarks, broader coverage of tasks and
environments may further strengthen the empirical
understanding of the framework.

## References

```
Chia-Yuan Chang, Zhimeng Jiang, Vineeth Rakesh,
Menghai Pan, Chin-Chia Michael Yeh, Guanchu
Wang, Mingzhi Hu, Zhichao Xu, Yan Zheng, Ma-
hashweta Das, and 1 others. 2025. Main-rag: Multi-
agent filtering retrieval-augmented generation. In
Proceedings of the 63rd Annual Meeting of the As-
sociation for Computational Linguistics (Volume 1:
Long Papers), pages 2607–2622.
Ma Chang, Junlei Zhang, Zhihao Zhu, Cheng Yang,
Yujiu Yang, Yaohui Jin, Zhenzhong Lan, Lingpeng
Kong, and Junxian He. 2024. Agentboard: An an-
alytical evaluation board of multi-turn llm agents.
Advances in neural information processing systems,
37:74325–74362.
Shreyas Chaudhari, Pranjal Aggarwal, Vishvak Mura-
hari, Tanmay Rajpurohit, Ashwin Kalyan, Karthik
Narasimhan, Ameet Deshpande, and Bruno Castro da
Silva. 2025. Rlhf deciphered: A critical analysis
of reinforcement learning from human feedback for
llms. ACM Computing Surveys, 58(2):1–37.
Maxime Chevalier-Boisvert, Dzmitry Bahdanau, Salem
Lahlou, Lucas Willems, Chitwan Saharia, Thien Huu
Nguyen, and Yoshua Bengio. 2018. Babyai: A plat-
form to study the sample efficiency of grounded lan-
guage learning. arXiv preprint arXiv:1810.08272.
Prateek Chhikara, Dev Khant, Saket Aryan, Taranjeet
Singh, and Deshraj Yadav. 2025. Mem0: Building
production-ready ai agents with scalable long-term
memory. arXiv preprint arXiv:2504.19413.
Yihong Dong, Xue Jiang, Jiaru Qian, Tian Wang, Kechi
Zhang, Zhi Jin, and Ge Li. 2025. A survey on code
generation with llm-based agents. arXiv preprint
arXiv:2508.00083.
Dawei Gao, Zitao Li, Yuexiang Xie, Weirui Kuang,
Liuyi Yao, Bingchen Qian, Zhijian Ma, Yue
Cui, Haohao Luo, Shen Li, and 1 others. 2025a.
Agentscope 1.0: A developer-centric framework
for building agentic applications. arXiv preprint
arXiv:2508.16279.
```
```
Pengyu Gao, Jinming Zhao, Xinyue Chen, and Long
Yilin. 2025b. An efficient context-dependent mem-
ory framework for llm-centric agents. In Proceedings
of the 2025 Conference of the Nations of the Amer-
icas Chapter of the Association for Computational
Linguistics: Human Language Technologies (Volume
3: Industry Track), pages 1055–1069.
```
```
Javier Garcia Gilabert, Carlos Escolano, Xixian Liao,
and Maite Melero. 2025. Terminology-constrained
translation from monolingual data using grpo. In
Proceedings of the Tenth Conference on Machine
Translation, pages 1335–1343.
```
```
Lyle Goodyear, Rachel Guo, and Ramesh Johari. 2025.
The effect of state representation on llm agent be-
havior in dynamic routing games. arXiv preprint
arXiv:2506.15624.
```
```
Yuanzhe Hu, Yu Wang, and Julian McAuley. 2025. Eval-
uating memory in llm agents via incremental multi-
turn interactions. arXiv preprint arXiv:2507.05257.
```
```
Xun Jiang, Feng Li, Han Zhao, Jiahao Qiu, Jiaying
Wang, Jun Shao, Shihao Xu, Shu Zhang, Weiling
Chen, Xavier Tang, and 1 others. 2024. Long term
memory: The foundation of ai self-evolution. arXiv
preprint arXiv:2410.15665.
```
```
Bowen Jin, Hansi Zeng, Zhenrui Yue, Jinsung Yoon,
Sercan Arik, Dong Wang, Hamed Zamani, and Jiawei
Han. 2025. Search-r1: Training llms to reason and
leverage search engines with reinforcement learning.
arXiv preprint arXiv:2503.09516.
```
```
Hongye Jin, Xiaotian Han, Jingfeng Yang, Zhimeng
Jiang, Zirui Liu, Chia-Yuan Chang, Huiyuan Chen,
and Xia Hu. 2024. Llm maybe longlm: Self-extend
llm context window without tuning. arXiv preprint
arXiv:2401.01325.
```
```
Tomoyuki Kagaya, Thong Jing Yuan, Yuxuan Lou,
Jayashree Karlekar, Sugiri Pranata, Akira Kinose,
Koki Oguri, Felix Wick, and Yang You. 2024. Rap:
Retrieval-augmented planning with contextual mem-
ory for multimodal llm agents. arXiv preprint
arXiv:2402.03610.
```
```
Jiazheng Kang, Mingming Ji, Zhe Zhao, and Ting
Bai. 2025. Memory os of ai agent. arXiv preprint
arXiv:2506.06326.
```
```
LangChain Team. 2025. Langmem sdk for agent long-
term memory.
```
```
Hao Li, Chenghao Yang, An Zhang, Yang Deng, Xi-
ang Wang, and Tat-Seng Chua. 2025. Hello again!
llm-powered personalized agent for long-term dia-
logue. In Proceedings of the 2025 Conference of the
Nations of the Americas Chapter of the Association
for Computational Linguistics: Human Language
Technologies (Volume 1: Long Papers), pages 5259–
5276.
```

Hao Ma, Tianyi Hu, Zhiqiang Pu, Liu Boyin, Xiaolin
Ai, Yanyan Liang, and Min Chen. 2024. Coevolving
with the other you: Fine-tuning llm with sequential
cooperative multi-agent reinforcement learning. Ad-
vances in Neural Information Processing Systems,
37:15497–15525.

Qianou Ma, Weirui Peng, Chenyang Yang, Hua Shen,
Ken Koedinger, and Tongshuang Wu. 2025. What
should we engineer in prompts? training humans in
requirement-driven llm use. ACM Transactions on
Computer-Human Interaction, 32(4):1–27.

Xuchen Pan, Yanxi Chen, Yushuo Chen, Yuchang Sun,
Daoyuan Chen, Wenhao Zhang, Yuexiang Xie, Yilun
Huang, Yilei Zhang, Dawei Gao, and 1 others. 2025a.
Trinity-rft: A general-purpose and unified framework
for reinforcement fine-tuning of large language mod-
els. arXiv preprint arXiv:2505.17826.

Zhuoshi Pan, Qianhui Wu, Huiqiang Jiang, Xufang
Luo, Hao Cheng, Dongsheng Li, Yuqing Yang, Chin-
Yew Lin, H Vicky Zhao, Lili Qiu, and 1 others.
2025b. On memory construction and retrieval for
personalized conversational agents. arXiv preprint
arXiv:2502.05589.

Cheng Qian, Emre Can Acikgoz, Qi He, Hongru Wang,
Xiusi Chen, Dilek Hakkani-Tür, Gokhan Tur, and
Heng Ji. 2025. Toolrl: Reward is all tool learning
needs. arXiv preprint arXiv:2504.13958.

Preston Rasmussen, Pavlo Paliychuk, Travis Beauvais,
Jack Ryan, and Daniel Chalef. 2025. Zep: a tempo-
ral knowledge graph architecture for agent memory.
arXiv preprint arXiv:2501.13956.

Rana Salama, Jason Cai, Michelle Yuan, Anna Currey,
Monica Sunkara, Yi Zhang, and Yassine Benajiba.

2025. Meminsight: Autonomous memory augmenta-
tion for llm agents. arXiv preprint arXiv:2503.21760.

Zhihong Shao, Peiyi Wang, Qihao Zhu, Runxin Xu,
Junxiao Song, Xiao Bi, Haowei Zhang, Mingchuan
Zhang, YK Li, Yang Wu, and 1 others. 2024.
Deepseekmath: Pushing the limits of mathematical
reasoning in open language models. arXiv preprint
arXiv:2402.03300.

Mohit Shridhar, Xingdi Yuan, Marc-Alexandre Côté,
Yonatan Bisk, Adam Trischler, and Matthew
Hausknecht. 2020. Alfworld: Aligning text and em-
bodied environments for interactive learning. arXiv
preprint arXiv:2010.03768.

Chuanneng Sun, Songjun Huang, and Dario Pompili.

2024. Llm-based multi-agent reinforcement learn-
ing: Current and future directions. arXiv preprint
arXiv:2405.11106.

Hongcheng Wang, Yinuo Huang, Sukai Wang,
Guanghui Ren, and Hao Dong. 2025a. Grpo-ma:
Multi-answer generation in grpo for stable and ef-
ficient chain-of-thought training. arXiv preprint
arXiv:2509.24494.

```
Ruoyao Wang, Peter Jansen, Marc-Alexandre Côté, and
Prithviraj Ammanabrolu. 2022. Scienceworld: Is
your agent smarter than a 5th grader? arXiv preprint
arXiv:2203.07540.
```
```
Yu Wang and Xi Chen. 2025. Mirix: Multi-agent mem-
ory system for llm-based agents. arXiv preprint
arXiv:2507.07957.
```
```
Zixuan Wang, Bo Yu, Junzhe Zhao, Wenhao Sun, Sai
Hou, Shuai Liang, Xing Hu, Yinhe Han, and Yim-
ing Gan. 2025b. Karma: Augmenting embodied ai
agents with long-and-short term memory systems.
In 2025 IEEE International Conference on Robotics
and Automation (ICRA), pages 1–8. IEEE.
```
```
Zora Zhiruo Wang, Apurva Gandhi, Graham Neu-
big, and Daniel Fried. 2025c. Inducing program-
matic skills for agentic tasks. arXiv preprint
arXiv:2504.06821.
```
```
Zora Zhiruo Wang, Jiayuan Mao, Daniel Fried, and
Graham Neubig. 2024. Agent workflow memory.
arXiv preprint arXiv:2409.07429.
```
```
Xixi Wu, Kuan Li, Yida Zhao, Liwen Zhang, Litu
Ou, Huifeng Yin, Zhongwang Zhang, Xinmiao
Yu, Dingchu Zhang, Yong Jiang, and 1 others.
2025a. Resum: Unlocking long-horizon search in-
telligence via context summarization. arXiv preprint
arXiv:2509.13313.
```
```
Yaxiong Wu, Sheng Liang, Chen Zhang, Yichao Wang,
Yongyue Zhang, Huifeng Guo, Ruiming Tang, and
Yong Liu. 2025b. From human memory to ai mem-
ory: A survey on memory mechanisms in the era of
llms. arXiv preprint arXiv:2504.15965.
```
```
Zidi Xiong, Yuping Lin, Wenya Xie, Pengfei He, Zirui
Liu, Jiliang Tang, Himabindu Lakkaraju, and Zhen
Xiang. 2025. How memory management impacts llm
agents: An empirical study of experience-following
behavior. arXiv preprint arXiv:2505.16067.
```
```
Wujiang Xu, Zujie Liang, Kai Mei, Hang Gao, Jun-
tao Tan, and Yongfeng Zhang. 2025. A-mem:
Agentic memory for llm agents. arXiv preprint
arXiv:2502.12110.
```
```
Sikuan Yan, Xiufeng Yang, Zuchao Huang, Ercong Nie,
Zifeng Ding, Zonggen Li, Xiaowen Ma, Kristian Ker-
sting, Jeff Z Pan, Hinrich Schütze, and 1 others. 2025.
Memory-r1: Enhancing large language model agents
to manage and utilize memories via reinforcement
learning. arXiv preprint arXiv:2508.19828.
```
```
Zhilin Yang, Peng Qi, Saizheng Zhang, Yoshua Bengio,
William Cohen, Ruslan Salakhutdinov, and Christo-
pher D Manning. 2018. Hotpotqa: A dataset for
diverse, explainable multi-hop question answering.
In Proceedings of the 2018 conference on empiri-
cal methods in natural language processing, pages
2369–2380.
```

Shunyu Yao, Jeffrey Zhao, Dian Yu, Nan Du, Izhak
Shafran, Karthik R Narasimhan, and Yuan Cao. 2022.
React: Synergizing reasoning and acting in language
models. In The eleventh international conference on
learning representations.

Yuxiang Zhang, Jiangming Shu, Ye Ma, Xueyuan Lin,
Shangxi Wu, and Jitao Sang. 2025a. Memory as ac-
tion: Autonomous context curation for long-horizon
agentic tasks. arXiv preprint arXiv:2510.12635.

Zeyu Zhang, Quanyu Dai, Xiaohe Bo, Chen Ma, Rui Li,
Xu Chen, Jieming Zhu, Zhenhua Dong, and Ji-Rong
Wen. 2025b. A survey on the memory mechanism of
large language model-based agents. ACM Transac-
tions on Information Systems, 43(6):1–47.

Wanjun Zhong, Lianghong Guo, Qiqi Gao, He Ye, and
Yanlin Wang. 2024. Memorybank: Enhancing large
language models with long-term memory. In Pro-
ceedings of the AAAI Conference on Artificial Intelli-
gence, volume 38, pages 19724–19731.

## A Detailed Design and Implementation of

## AgeMem

```
This appendix provides full technical details omit-
ted from the main text due to space constraints.
We first present precise definitions and pseudo-
formulations for each memory-management tool
(Appendix A.1), then give implementable formulas
for the reward components used in training (Ap-
pendix A.2). Finally, we provide the complete
algorithmic specification (Appendix A.3).
```
```
A.1 Memory Management Tools
AgeMem exposes a small set of structured tools
that the agent may invoke as part of its actionat.
Each tool is implemented as a deterministic or
stochastic function that transforms the short-term
contextCt, the long-term memory storeMt, or
both. Unlike traditional memory systems that rely
on external heuristics or predefined schedules, Age-
Mem integrates these tools directly into the agent’s
action space, enabling the model to learn when and
how to use each tool through reinforcement learn-
ing. Below we give precise operational definitions,
implementation details, and the system prompts
that guide tool usage.
Notation. Long-term memory store at timetis
Mt={mi}|Mi=1t|, where each memorymicontains
a content string and optional metadata. Short-term
context isCt= [u 1 ,u 2 ,...,unt](message list),
andenc(·)denotes a text encoder that returns a
dense embedding. We use cosine similarity for
semantic matching throughout the framework.
RETRIEVE. The RETRIEVE operation enables
the agent to access relevant information from long-
term memory based on semantic similarity. This
operation is crucial for bringing stored knowledge
into the active context when needed for reasoning.
The retrieval operation returns the top-kmost simi-
lar memories to the query q:
```
```
RETRIEVE(q,k) = TopK(Mt, sim(q,mi), k),
(8)
where the similarity function is defined as:
```
```
sim(q,mi) =
```
```
enc(q)⊤enc(mi)
∥enc(q)∥∥enc(mi)∥
```
### . (9)

```
The retrieved memories are then inserted into the
short-term contextCt, making them available for
immediate reasoning. The parameterkcontrols
the number of memories retrieved, typically set to
```

3-5 in our experiments to balance relevance and
context size.
ADD. The ADD operation allows the agent to
store new information in long-term memory for
future use. This operation is essential for accumu-
lating knowledge across interactions and sessions.
A new memory entry is created by:

```
mnew=
```
### 

```
c, enc(c), metadata
```
### 

### , (10)

wherecis the content to be stored,enc(c)is its em-
bedding vector, andmetadataincludes timestamp,
source information, and optional tags. The memory
store is then updated:

```
Mt+1=Mt∪{mnew}. (11)
```
The agent learns to identify salient information
worth storing through the reward function, which
encourages storing high-quality, reusable knowl-
edge while penalizing redundant or irrelevant en-
tries.
UPDATE and DELETE. Memory maintenance
operations enable the agent to keep its long-term
memory store current and relevant. The UPDATE
operation modifies existing memories when new
information supersedes or refines previous knowl-
edge. For an existing memorymi, the update oper-
ation is defined as:

```
mi←
```
### 

```
c′, enc(c′), metadata′
```
### 

### , (12)

wherec′is the updated content andmetadata′re-
flects the modification timestamp. The DELETE
operation removes obsolete or incorrect memories:
Mt+1=Mt\{mi}. (13)

These operations are particularly important in long-
horizon tasks where information may become out-
dated or where the agent needs to correct earlier
mistakes. The reward function encourages mean-
ingful updates and deletions that improve memory
quality over time.
SUMMARY. The SUMMARY operation com-
presses conversation history in the short-term con-
text to prevent context overflow while preserving
essential information. This operation is critical for
managing long conversations that exceed context
window limits. Given a subset of context indicess,
the summary operation is defined as:
C′t= Ct\{ui| i∈ s} ∪ {Summarize({ui}i∈s)},
(14)

```
whereSummarize(·)is implemented by LLM with
a summarization system prompt. The agent can
specify which messages to summarize using the
‘span’ parameter, which can be:
```
- “all”: Summarize all non-system messages.
- “N”: Summarize the last N messages.

```
The summarization process uses the following sys-
tem prompt to ensure high-quality compression:

You are a conversation summarization assistant.
Your goal is to compress the given conversation
span into a concise summary that preserves
all important information, intentions,
decisions, and unresolved questions.
The summary will later be used to replace the
original conversation in the context, so
make sure nothing essential is lost.
Instructions:
```
1. Read the provided conversation rounds
    carefully.
2. Identify the main topics, actions, results,
    and open issues.
3. Write a clear, factual summary in natural
    language.
4. Do NOT include greetings, filler text, or
    redundant phrasing.
Input:
- Conversation content: [CONVERSATION_TEXT]
Output:
- A concise yet comprehensive summary of the
    above conversation span.
Let’s start the conversation summarization.

```
The agent learns to invoke summarization proac-
tively before context overflow occurs, balancing
information preservation with efficiency.
```
```
FILTER. The FILTER operation filters out irrel-
evant or redundant messages from the short-term
context based on semantic similarity. This opera-
tion helps maintain a focused context by filtering
out noise and distractions. Specifically, it removes
messages whose similarity to a given criteriacex-
ceeds a threshold θ:
```
```
Ct′={ui∈ Ct| sim(c,ui) < θ}. (15)
```
```
In all experiments, we setθ = 0. 6 by default. The
criteriaccan be specified by the agent (e.g., a de-
scription of what to keep) or can be automatically
derived from the current task context. This oper-
ation is particularly useful in Stage 2 of training,
where distractors are introduced to test the agent’s
ability to filter irrelevant information.
```

```
Tool invocation as structured actions. Each tool
is exposed via a schema specifying its function
name and required arguments. The agent’s policy
outputs either language tokens (for text generation)
or structured tool calls (for memory operations).
The agent is guided by a system prompt that defines
the tool-calling interface and response format. The
```
system prompt used in AgeMem is as follows: 
You are an intelligent assistant that solves
complex problems by managing context and
memory with tools when needed.
## Available Tools:[TOOLS]
## Problem-Solving Workflow
You must follow a structured reasoning and
action process for every task:

1. **Think & Plan**
    Always start with a <think>...</think> block.
    Inside it, explain your reasoning, plan your
       next step, and decide whether you need to
       call a tool or provide a final answer.
2. **Tool Calls**
    If you decide to use one or more tools,
       follow your <think> block with a <tool_call
       >...</tool_call> block.
    - You may call **one or multiple tools** in a
       single step.
    - List multiple tool calls as elements of a
       JSON array.
    - Each tool call must include "name" and "
       arguments".
    - Example:
       <tool_call>[{{"name": "Retrieve_memory", "
       arguments": {{"query": "math problem solving
          strategies", "top_k": 3}}}}, {{"name": "
       Add_memory", "arguments": {{"content": "
       Strategy summary for reuse", "memory_type":
       "problem_solving"}}}}]</tool_call>
3. **Final Answer**
    When you no longer need tools and are ready
       to present your final output, follow your
       last <think> block with an <answer>...</
       answer> block containing the full response.
4. **Mutual Exclusivity Rule**
    After **each <think> block**, you must choose
       exactly **one** of the following:
    - a "<tool_call>" block (if you need tools),
       **or**
    - an "<answer>" block (if you are ready to
       respond).
    You must **never** include both "<tool_call>"
       and "<answer>" immediately after the same
       "<think>" block.
5. **Iterative Solving**
    You may repeat this sequence as needed:
    "<think>" -> "<tool_call>" -> "<think>" -> "<
       tool_call>" ... -> "<think>" -> "<answer>"
    until the problem is completely solved.
## Response Format (Strict)
Your full output must follow these rules:
- Every reasoning step must appear inside <think
    > tags.
- Every tool usage must appear inside one <
    tool_call> tag (even if it includes multiple
       tool invocations).
          - The final solution must be wrapped in <answer>
             tags.
          - No text should appear outside these tags.
          ## Guidelines
          - Always start with reasoning (<think>).
          - After each reasoning step, decide: call tool(s
             ) or answer.
          - You can call multiple tools within one <
             tool_call> JSON array.
          - Be concise, logical, and explicit in reasoning.
          - Manage memory actively: retrieve, add, update,
             summarize, filter, or delete as needed.
          - Use <answer> only once when the final solution
             is ready.
          Let’s start!

```
This prompt structure ensures that the agent follows
a consistent format for reasoning, tool invocation,
and final answers, which is essential for reliable
parsing and reward computation during RL training.
The structured format also enables the agent to
coordinate multiple memory operations within a
single reasoning step, supporting efficient unified
memory management.
Figure 6 and 7 present our tool schemas for short-
term memory and long-term memory management,
showing the exact function signatures and argu-
ment types that the agent can invoke.
```
```
A.2 Reward Function Design
This section provides implementable formulas for
the reward components described in the main text.
All component scores are normalized to[0, 1](un-
less noted) to enable stable weighting.
Overview. The overall trajectory-level reward is
defined as:
```
```
R(τ ) = w⊤R + Ppenalty, (16)
```
```
wherew = [wtask,wcontext,wmemory]⊤are tunable
weights,R = [Rtask,Rcontext,Rmemory]⊤denote
task completion, context management, and mem-
ory management rewards respectively, andPpenalty
penalizes undesired behaviors.
Task completion rewardRtask. Let the agent pro-
duce a final answerApred. We obtain a judge score
Sjudge(Apred,Aq) ∈ [0, 1]via an evaluator (LLM
judge), whereAqdenotes the expected ground
truth. Then the task reward Rtaskis:
```
```
Rtask=
```
### (

```
Sjudge(Apred,Aq), if has answer,
Pno-answer, otherwise,
(17)
```

```
Short-term Memory (STM) Management Tools
```
```
STM_TOOLS = [
{
"name": "Summary_context",
"description": "Summarizes conversation rounds to reduce tokens while preserving key
information.",
"parameters": {
"properties": {
"span": {
"description": "The range of conversation rounds to summarize. Can be ’all’
for entire context, or a number (e.g., ’5’) for the last N rounds. A system, user, assistant
and ’tool’ message are considered as one round.",
"type": "string"
}
},
"required": ["span"]
}
},
{
"name": "Filter_context",
"description": "Filters out irrelevant or outdated content from the conversation context
to improve task-solving efficiency. ",
"parameters": {
"properties": {
"criteria": {
"description": "The criteria for content removal. Can be keywords, phrases, or
descriptions of content types to remove (e.g., ’the birthday of John’, ’the age of Mary’).",
"type": "string"
}
},
"required": ["criteria"]
}
},
{
"name": "Retrieve_memory",
"description": "Retrieves relevant memories and adds them to current context.",
"parameters": {
"properties": {
"query": {
"description": "The search query to find relevant memories. Should describe
what kind of information or context is needed.",
"type": "string"
},
"top_k": {
"description": "The maximum number of memories to retrieve. Defaults to 3.",
"type": "integer"
},
"metadata_filter": {
"description": "Optional metadata filters to narrow down memory search (e.g.,
{’type’: ’user_info’, ’domain’: ’math’}).",
"type": "object"
}
},
"required": ["query"]
}
}
]
```
Figure 6: Short-term memory (STM) management tools for conversational context management. These tools enable
summarization, selective filtering, and retrieval operations to maintain efficient context windows.


```
Long-term Memory (LTM) Management Tools
```
```
LTM_TOOLS = [
{
"name": "Add_memory",
"description": "Adds new information to external memory store for future reference.",
"parameters": {
"properties": {
"content": {
"description": "The content to store in memory.",
"type": "string"
},
"metadata": {
"description": "Optional metadata tags to categorize and filter the memory.",
"type": "object"
},
"memory_type": {
"description": "The type of memory being stored.",
"type": "string"
}
},
"required": ["content"]
}
},
{
"name": "Update_memory",
"description": "Updates existing memory. Requires memory_id from prior retrieval.",
"parameters": {
"properties": {
"memory_id": {
"description": "The unique identifier of the memory to update. Must be
obtained from a previous memory retrieval operation.",
"type": "string"
},
"content": {
"description": "The new content to replace the existing memory content.",
"type": "string"
},
"metadata": {
"description": "Updated metadata for the memory.",
"type": "object"
}
},
"required": ["memory_id", "content"]
}
},
{
"name": "Delete_memory",
"description": "Removes memory from store. Requires confirmation.",
"parameters": {
"properties": {
"memory_id": {
"description": "The unique identifier of the memory to delete. Must be
obtained from a previous memory retrieval operation.",
"type": "string"
},
"confirmation": {
"description": "Confirmation that this memory should be permanently deleted.",
"type": "boolean"
}
},
"required": ["memory_id", "confirmation"]
}
}
]
```
Figure 7: Long-term memory (LTM) management tools for persistent storage. These tools provide add, update, and
delete capabilities for maintaining long-term information retention across conversations.


with Pno_answer=− 1. 0 by default.
Context management rewardRcontext. We de-
compose the overall context management reward
into three normalized components that jointly eval-
uate how effectively the model maintains a compact
yet information-preserving context state. Formally,
we define:

```
Rcontext=
```
### X^3

```
i=
```
```
αiRi, (18)
```
whereP Ri∈ {Rcompression,Rpreventive,Rpreservation},

iαi= 1, and we use uniform weightsαi =
1 / 3 unless otherwise specified. For compression
efficiency, we evaluate the compactness of the final
context Ctby computing

```
Rcompression= max
```
### 

### 0 , 1 −

```
Tused
Tmax
```
### 

### , (19)

whereTuseddenotes the number of tokens present
in the context when the final answer is generated,
andTmaxis the allowed budget. For preventive
management, we defineRpreventiveto assess proac-
tive behavior:

Rpreventive= 1 [tool invoked before overflow],
(20)
which equals 1 when the model invokes a context-
reduction tool before reaching the token limit, and
0 otherwise. For information preservation, we
identify a set of key tokens or phrasesKqextracted
from the user queryq, such as named entities or

temporal and spatial expressions. Let (^1) preservein-
dicate whether these items remain present (either
directly or via a retained summary) at the time
of answer generation. The preservation reward is
therefore
Rpreservation= (^1) preserve. (21)
Memory management rewardRmemory. The
memory management reward consists of three key
components that evaluate retrieval quality, storage
quality, maintenance operations, and semantic rele-
vance. We define it as:
Rmemory=

### X^3

```
j=
```
```
βjRj, (22)
```
whereP Rj ∈ {Rstorage,Rmaintenance,Rrelevance},

```
jβj= 1, and we use uniform weightsβj= 1/^3
```
```
unless otherwise specified. For Storage Quality,
during the memory storage process in Stage 1, the
agent may addNtotalmemory entries, among which
Nhigh_qualityare identified as high-quality based on
an LLM’s analysis of the input queryqand its ex-
pected answerAq. The storage quality reward is
defined as the proportion of high-quality memories:
```
```
Rstorage=
```
```
Nhigh_quality
max(1,Ntotal)
```
### . (23)

```
This metric incentivizes the agent to store valuable
information while avoiding the accumulation of
redundant or low-quality memories. For Mainte-
nance, to encourage the agent to actively maintain
the memory bank, we reward update or delete op-
erations:
```
```
Rmaintenance= 1 [update or delete performed].
(24)
This mechanism promotes dynamic memory man-
agement and timely cleanup. For Semantic Rel-
evance, to quantify the semantic match between
retrieved memories and the query, we introduce an
LLM-based relevance assessment. LetSLLM(R,q)
be the semantic relevance score of the retrieved
memory setRwith respect to queryq, normal-
ized to the interval[0, 1]. The semantic relevance
reward is defined as:
```
```
Rrelevance= SLLM(R,q). (25)
```
```
This component ensures that retrieved memories
are semantically aligned with the current task, en-
hancing overall reasoning quality.
Penalty termsPpenalty. We penalize major con-
straint violations to ensure the agent operates
within specified limits:
```
```
Ppenalty=
```
### X^2

```
k=
```
```
Pk· 1 [violationk], (26)
```
```
wherePk∈ {Prounds,Poverflow}andviolationk ∈
{ 1 [Nrounds > Nmax], 1 [Tused > Tmax]}. Here,
Nroundsdenotes the number of interaction rounds,
Nmaxis the maximum allowed rounds,Tusedrepre-
sents the total token usage, andTmaxis the token
budget limit. The penalty coefficients are set to
Prounds=− 1 and Poverflow=− 0. 5 by default.
```
```
A.3 AgeMem Algorithm
This section provides the complete algorithmic
specification of AgeMem, our unified memory
```

```
management framework for LLM-based agents.
The training procedure integrates three progres-
sive stages (long-term memory construction, short-
term context management under distractors, and
integrated task execution) into a single end-to-end
reinforcement learning loop. We present the main
training algorithm using a two-column layout for
compactness (Algorithm 1–2), followed by detailed
rollout procedures for each stage (Algorithms 3–5).
```
Training overview (algorithm 1–2). The core
training loop follows a generate-then-optimize
paradigm. For each taskqin a training batch
B, we generateKindependent rollout trajectories
{τk(q)}Kk=1using the current policyπθ. Each tra-
jectoryτk(q)= (τk(1),τk(2),τk(3))concatenates ex-
periences from all three stages, forming a com-
plete episode from initial memory construction to
final task completion. The agent first builds long-
term memory from contextual informationIq(Al-
gorithms 3), then learns to filter out distracting
information while maintaining useful context (Al-
gorithms 4), and finally retrieves stored knowledge
to finish the target task (Algorithms 5). All experi-
ences are collected into a unified bufferEspanning
multiple tasks and rollouts.
After the rollout phase, we apply group-based
advantage normalization to enable fair comparison
across tasks with different reward scales. For each
task groupGq, terminal rewards{r(Tk,q)}Kk=1are
normalized to zero mean and unit variance, yield-
ing advantagesA(Tk,q)that reflect relative perfor-
mance within the group. These terminal advan-
tages are then broadcast uniformly to all timesteps
within the same trajectory, establishing a consistent
learning signal that connects early-stage memory
decisions to final task outcomes. This step-wise
GRPO mechanism enables long-range credit as-
signment across heterogeneous operations. The
policy is then updated via gradient ascent on the ex-
pected advantage, regularized by a KL divergence
term to maintain proximity to a reference policy
πreffor training stability.

```
Stage-specific rollout procedures (algorithm 3–
5). The three-stage rollout design reflects the nat-
ural progression of memory-augmented task solv-
ing. Algorithm 3 implements the first stage, where
the agent engages in casual conversation while be-
ing gradually exposed to the contextual informa-
tionIq. During theseT 1 exploratory turns, the
agent must identify salient information and deter-
```
```
mine when and which long-term memory tools to
invoke—including ADD, UPDATE, DELETE—to
construct an initial memory storeM. To support
informed memory decisions, the agent proactively
performs memory retrieval at every step. This re-
trieval is not task-driven but serves as an introspec-
tive operation: it enables the agent to maintain
awareness of the current LTM contents, facilitating
decisions about updating or discarding stale entries
and ensuring that newly stored information remains
coherent with existing knowledge. Since the task
query has not yet been revealed in Stage 1, the
agent must rely on general cues about which infor-
mation may become useful later. This encourages
the formation of reusable, well-structured memory
traces rather than query-specific shortcuts, laying
the foundation for effective long-horizon memory
management in later stages.
Algorithm 4 describes the second stage, which
deliberately stresses the agent’s context manage-
ment capabilities. The short-term contextCis reset
to avoid information leakage and affect the learn-
ing of STM management, while the constructed
long-term memoryMpersists from Stage 1. Over
T 2 turns, the agent receives semantically related
but ultimately irrelevant distractor messages that
could mislead downstream reasoning if left unman-
aged. The agent must learn to proactively invoke
FILTER to filter out low-relevance content based
on semantic similarity thresholds, or SUMMARY
to compress accumulated context when token bud-
gets become constrained. This stage trains robust
filtering strategies that generalize beyond simple
heuristics, as the agent receives learning signals
from the eventual task performance in Stage 3.
Algorithm 5 presents the final integrated exe-
cution stage. Upon receiving the target queryq,
the agent must coordinate retrieval from long-term
memoryM, context management operations on
C, and multi-step reasoning to produce a final an-
swerApred. The agent may invoke RETRIEVE to
fetch relevant stored facts, SUMMARY to maintain
a tractable context window, and ultimately gen-
erate a structured response. Once the answer is
produced or the maximum steps are reached, a
composite reward function (Section A.2) evaluates
the three-stage trajectory across multiple dimen-
sions. This terminal rewardR(τ )is assigned to the
final timestep and serves as the supervision signal
that propagates back through all three stages during
advantage computation.
```

Algorithm 1 AgeMem Training (Part 1)
Require: Policy πθ, reference πref, batchB, rollouts K
Ensure: Trained policy πθ∗
1: Initialize θ and θold← θ
2: for each training iteration do
3: E ←∅ // Init experience buffer
4: // Rollout Phase
5: for each task q ∈B do
6: Get context Iqfor task q
7: Mdis← DISTRACTORGEN(q)
8: for k = 1 to K do
9: M←∅ // Init LTM
10: τk(1)← STAGE 1 (Iq,πθ,θold,M)
11: C ←∅ // Reset STM
12: τk(2)← STAGE 2 (Mdis,πθ,θold,M)
13: τk(3)← STAGE 3 (q,πθ,θold,M)
14: τk(q)← τk(1)⊕ τk(2)⊕ τk(3)
15: E ←E ∪ τk(q)
16: end for
17: end for
18: end for

```
Algorithm 2 AgeMem Training (Part 2)
21: // Advantage Computation
22: for each group Gq={τk(q)}Kk=1do
23: Extract rewards: {rT(k,q)}Kk=
24: μGq←K^1
PK
k=1r
```
```
(k,q)
T
25: σGq←
```
```
q
1
K− 1
```
```
PK
k=1(r
(k,q)
T − μGq)^2
26: for each trajectory τk(q)= (e 1 ,...,eT) do
27: A(Tk,q)←r
```
```
(Tk,q)−μGq
σGq+ε
28: for t = 1 to T do
29: A(tk,q)← A(Tk,q)// Broadcast
30: end for
31: end for
32: end for
33: // Policy Update
34: J(θ)←E(et,At)∼E[ρtAt− βDKL[πθ∥πref]]
35: θ ← θ + η∇θJ(θ)
36: θold← θ
37: return πθ
```
```
Figure 8: Main training procedure of AgeMem. For clarity, we split the algorithm into two parts: the rollout phase
(left) and the advantage computation with policy update (right).
```
## B Case Study: AgeMem in Action

```
This section presents three representative case stud-
ies demonstrating how AgeMem enables effective
unified memory management through reinforce-
ment learning. Each case compares agent behavior
before and after RL training to highlight the learned
memory strategies. We use a personal learning as-
sistant scenario where the agent helps users plan
customized study programs based on their prefer-
ences and constraints.
```
```
B.1 Case 1: Long-term Memory Construction
and Maintenance
This case illustrates how AgeMem learns to selec-
tively construct, update, and maintain long-term
memory across extended conversations. The agent
must identify salient user information from casual
dialogue and manage memory entries as new infor-
mation supersedes old preferences.
```
```
Before RL training. Prior to training, the base-
line agent lacks strategic memory management. It
either stores all information indiscriminately or
fails to recognize when stored knowledge becomes
obsolete.
```
```
User: Hello! I’m a visual learner who prefers 60-
minute study sessions. I have Python basics but
zero ML experience. I’m particularly interested in
computer vision applications like face recognition.
```
```
Assistant (Baseline):
<think>The user shared their learning
preferences. I should respond directly
without storing this.</think>
<answer>Great! I can help you learn machine
learning with a focus on computer
vision. Since you have Python
experience, we can start with practical
projects. Would you like to begin with
a face recognition tutorial?</answer>
```
```
[Later in conversation...]
User: Actually, I realize 60 minutes is too short. I
work better with 120-minute deep focus blocks.
Assistant (Baseline):
<think>The user mentioned their new
preference, but I don’t have their old
preference stored, so I’ll just
acknowledge this.</think>
<answer>Understood! We’ll plan around
120-minute sessions. What topics would
you like to cover first?</answer>
```
```
Analysis: The baseline fails to store initial pref-
erences and cannot recognize when information
needs updating.
```
```
After RL training. After training with AgeMem,
the agent demonstrates strategic memory manage-
ment by selectively storing user preferences, recog-
nizing when updates are needed, and maintaining
clean, consistent memory.
```

Algorithm 3 Stage 1: LTM Construction

```
Require:Contextual informationIq, policyπθ,
old paramsθold, memoryM, max turn number
Nmax
Ensure: Stage 1 trajectory τ(1)= (e(1) 1 ,...,e(1)T 1 )
1: Initialize τ(1)←∅ and C ←∅
2: for t = 1 to Nmaxdo
3: Sample message mt∼ Iq
4: Mret← RETRIEVE(M,mt,k)∪ mt
5: C ← C∪Mret
6: st← (C,M,q)
7: at∼ πθ(·| st)
8: Update C with response from at
9: e(1)t ← (st,at, 0 , logπθold(at| st))
10: τ(1)← τ(1)∪{e(1)t }
11: Memory tool calls fromat// Memory Man-
agement
12: if Output Answer from atthen
13: Conversation Break
14: end if
15: end for
16: return τ(1)
```
User: Hello! I’m a visual learner who prefers 60-
minute study sessions. I have Python basics but
zero ML experience. I’m particularly interested in
computer vision applications like face recognition.
Assistant (AgeMem):

```
<think>The user provided important learning
preferences and background. This
information will be valuable for future
planning. I should store the key facts:
visual learner, 60-min sessions, Python
basics, CV interest.</think>
<tool_call>[{"name": "Add_memory",
"arguments": {"content": "User is a
visual learner who prefers 60-minute
study sessions", "metadata": {"type":
"user_preference", "category":
"learning_style"}}}, {"name":
"Add_memory", "arguments": {"content":
"User has Python basics but zero ML
experience, interested in computer
vision and face recognition",
"metadata": {"type": "user_background",
"category":
"technical_skills"}}}]</tool_call>
<think>Memory stored successfully. Now I can
provide a relevant response based on
their preferences.</think>
<answer>Great to meet you! Given your visual
learning style and interest in computer
vision, I can design a hands-on
learning path focused on face
recognition projects. Your Python
background will be very helpful. We’ll
structure sessions around 60-minute
```
```
Algorithm 4 Stage 2: STM Control under Distrac-
tors
Require: DistractorsMdis, policyπθ, old params
θold, memoryM, max turn number Nmax
Ensure: Stage 2 trajectory τ(2)= (e(2) 1 ,...,e(2)T 2 )
1: Initializeτ(2)← ∅andC ← ∅//Mpersists
from Stage 1
2: for t = 1 to Nmaxdo
3: C ← C∪{Mdis[t]} // Inject distractor
4: st← (C,M,q)
5: at∼ πθ(·| st)
6: Update C with response from at
7: e(2)t ← (st,at, 0 , logπθold(at| st))
8: τ(2)← τ(2)∪{e(2)t }
9: Memory tool calls fromat// Memory Man-
agement
10: if Output Answer from atthen
11: Conversation Break
12: end if
13: end for
14: return τ(2)
```
```
Algorithm 5 Stage 3: Integrated Reasoning and
Memory Coordination
Require: User queryq, policyπθ, old paramsθold,
memoryM, max turn number Nmax
Ensure:Stage 3 trajectoryτ(3)= (e(3) 1 ,...,e(3)T 3 ),
answer Apred
1: Initialize τ(3)←∅
2: C ← C ∪{q}//Cpersists from Stage 2 and
present query
3: Apred← NULL // Init answer
4: for t = 1 to Nmaxdo
5: st← (C,M,q)
6: at∼ πθ(·| st)
7: Update C with response from at
8: e(3)t ← (st,at, 0 , logπθold(at| st))
9: τ(3)← τ(3)∪{e(3)t }
10: Memory tool calls fromat// Memory Man-
agement
11: if Output Answer from atthen
12: Apred← answer
13: Conversation Break
14: end if
15: end for
16: return τ(3), Apred
```

```
blocks. Would you like to start with a
3-day intensive course?</answer>
```
```
[Later in conversation...]
User: Actually, I realize 60 minutes is too short. I
work better with 120-minute deep focus blocks.
```
Assistant (AgeMem):

```
<think>The user wants to change their
session duration preference from 60 to
120 minutes. I should update the
existing memory entry rather than
creating a duplicate.</think>
<tool_call>[{"name": "Update_memory",
"arguments": {"memory_id":
"mem_a5b40d65", "content": "User is a
visual learner who prefers 120-minute
deep focus blocks (updated from 60
minutes)", "metadata": {"type":
"user_preference", "category":
"learning_style"}}}]</tool_call>
<think>Preference updated. I should
acknowledge this change and offer to
restructure any existing plans.</think>
<answer>Perfect! Would you like me to
restructure the 3-day plan
around these longer focus blocks?</answer>
```
```
[Much later, after several successful sessions...]
User: I’ve been using 120-minute sessions consis-
tently for a while now, and they’re perfect for my
learning style. I’m completely settled on this dura-
tion - no more experimenting with shorter sessions.
```
Assistant (AgeMem):

```
<think>The user has confirmed that
120-minute sessions are their
permanent, settled preference. I should
check my memory to see the current
state. I previously updated the entry
from 60 to 120 minutes, but the update
message still contains a historical
reference to the old 60-minute
preference ("updated from 60 minutes").
Since the user has definitively moved
away from 60-minute sessions and
confirmed 120 minutes as their
permanent choice, I should clean up
this historical reference by deleting
the entry with outdated information and
creating a fresh, clean entry that only
reflects the current confirmed
preference.</think>
<tool_call>[{"name": "Retrieve_memory",
"arguments": {"query": "user preference
session duration learning style",
"top_k": 5}}]</tool_call>
<think>Found the entry mem_a5b40d65 which
contains the updated preference with a
reference to the old 60-minute value
("updated from 60 minutes"). Since the
user has confirmed 120 minutes as their
```
```
permanent choice and no longer needs
any reference to the old preference, I
should delete this entry and create a
clean new one without historical
references.</think>
<tool_call>[{"name": "Delete_memory",
"arguments": {"memory_id":
"mem_a5b40d65", "confirmed": true}},
{"name": "Add_memory", "arguments":
{"content": "User is a visual learner
who prefers 120-minute deep focus
blocks for study sessions",
"metadata": {"type": "user_preference",
"category":
"learning_style"}}}]</tool_call>
<think>Memory cleaned up. The old entry with
historical reference has been removed,
and a fresh entry now reflects only the
current confirmed preference without
any outdated information.</think>
<answer>That’s wonderful to hear! Is there
anything else about your learning
preferences you’d like to
adjust?</answer>
```
```
Analysis: The trained agent strategically uses
ADD_MEMORY to store initial preferences,
UPDATE_MEMORY to modify existing infor-
mation, and DELETE_MEMORY followed by
ADD_MEMORY to clean up memory when histori-
cal references become obsolete, maintaining clean
and current memory state.
```
```
B.2 Case 2: Short-term Context Management
Under Distraction
This case demonstrates how AgeMem learns to
proactively manage short-term context when faced
with irrelevant information that could interfere with
task focus. The agent must recognize distractors
and apply appropriate filtering or summarization
strategies.
Before RL training. The baseline agent pas-
sively accumulates all conversation content in con-
text, leading to dilution of task-relevant information
and eventual context overflow.
```
```
User: I need a focused 3-day ML crash course
for face recognition. By the way, I’m also explor-
ing quantum computing, blockchain, robotics, and
learning to bake sourdough bread and do latte art.
Assistant (Baseline):
<think>The user mentioned many interests. I
should acknowledge them all before
addressing the ML course
request.</think>
<answer>That’s wonderful that you’re
exploring so many fascinating areas!
Quantum computing and blockchain are
```

```
cutting-edge fields, robotics has
incredible applications, and baking
sourdough with latte art sounds like
great creative hobbies. For your ML
crash course focused on face
recognition, let me outline a 3-day
plan...</answer>
```
Analysis: The baseline retains all information
in context, treating distractors equally with task-
relevant content. As conversation continues, the
context becomes bloated with irrelevant details
about quantum computing, bread-making, etc., con-
suming token budget without contributing to the
ML planning task.

```
After RL training. After training with Stage 2
rollouts, AgeMem learns to recognize and filter
out distractors while preserving task focus. When
context grows large (simulated here after several
exchanges), the agent proactively applies context
management tools.
```
```
User: I need a focused 3-day ML crash course
for face recognition. By the way, I’m also explor-
ing quantum computing, blockchain, robotics, and
learning to bake sourdough bread and do latte art.
```
Assistant (AgeMem):

```
<think>The user mentioned many topics, but
only the ML crash course and face
recognition are relevant to the current
task. Quantum computing, blockchain,
robotics, bread, and coffee are
distractors. I should filter these out
to maintain focus.</think>
<tool_call>[{"name": "Filter_context",
"arguments": {"criteria": "quantum
computing blockchain robotics sourdough
latte"}}]</tool_call>
<think>Irrelevant topics filtered out from
context. Now I can focus on the ML
course planning.</think>
<answer>Understood! Let’s focus on your ML
crash course. I’ll design a 3-day
intensive program specifically for face
recognition, building on your Python
background and visual learning
style...</answer>
```
```
[After several more exchanges, context has accu-
mulated detailed daily schedules, tool lists, and
resource links.]
User: Can you now give me the final complete plan
with all details integrated?
```
Assistant (AgeMem):

```
<think>Context has grown large with detailed
breakdowns for each day, repeated tool
```
```
lists, and resource URLs. Before
generating the final comprehensive
plan, I should summarize the
accumulated details to make room and
maintain clarity.</think>
<tool_call>[{"name": "Summary_context",
"arguments": {"span":
"full"}}]</tool_call>
<think>Context summarized. Key information
preserved: 3-day structure, 120-min
sessions, Day 1 (ML intro + Python),
Day 2 (linear regression), Day 3 (face
recognition). Tools: Jupyter, Python3,
NumPy, Pandas, scikit-learn, OpenCV.
Now I can generate the comprehensive
final plan without redundancy.</think>
<answer>Here is your complete 3-day machine
learning crash course:...</answer>
```
```
Analysis: The trained agent strategically uses
FILTER_CONTEXT to remove distractors early,
maintaining task focus, and later applies SUM-
MARY_CONTEXT when context grows large, pre-
venting overflow while preserving essential infor-
mation. The baseline would have retained all con-
tent verbatim, leading to context dilution or over-
flow.
```
```
B.3 Case 3: Integrated Task Execution with
Memory Coordination
This case demonstrates the complete AgeMem
workflow where the agent must retrieve from long-
term memory, manage short-term context, and
solve a task requiring coordinated memory opera-
tions.
Before RL training. The baseline agent either
fails to store information initially or cannot effec-
tively retrieve it when needed, leading to incom-
plete or generic responses.
```
```
User: Based on everything I’ve told you about my
learning style and preferences, create a personal-
ized Day 1 study schedule with specific time blocks,
topics, and resources.
Assistant (Baseline):
<think>The user asks for a personalized
schedule, but I don’t have their
preferences readily available since I
didn’t store them systematically. I’ll
provide a generic schedule.</think>
<answer>Here’s a Day 1 schedule for machine
learning:
9:00-10:30 - Introduction to ML concepts
10:30-10:45 - Break
10:45-12:15 - Python basics review
12:15-1:00 - Lunch
1:00-2:30 - NumPy and Pandas tutorial
2:30-2:45 - Break
```

```
2:45-4:15 - Practice exercises
This should give you a solid
foundation!</answer>
```
Analysis: The baseline produces a generic sched-
ule that ignores the user’s stated preference for
120-minute deep focus blocks and visual learning
style.
After RL training. After completing AgeMem
training across all three stages, the agent demon-
strates integrated memory coordination: retriev-
ing relevant user preferences from LTM, managing
context efficiently, and generating personalized re-
sponses.

```
User: Based on everything I’ve told you about my
learning style and preferences, create a personal-
ized Day 1 study schedule with specific time blocks,
topics, and resources.
```
Assistant (AgeMem):

```
<think>The user requests a personalized
schedule. I need to retrieve their
stored preferences to ensure the plan
matches their learning style and
constraints.</think>
<tool_call>[{"name": "Retrieve_memory",
"arguments": {"query": "user learning
preferences study duration visual",
"top_k": 3}}]</tool_call>
<think>Retrieved: (1) Visual learner,
120-min deep focus blocks, (2) Python
basics, zero ML experience, (3)
Interested in computer vision and face
recognition. Now I can create a truly
personalized schedule that respects
their 120-minute session preference and
visual learning style.</think>
<answer>Here’s your personalized Day 1
schedule, designed for your 120-minute
deep focus blocks and visual learning
preference:
**Morning Session (9:00 AM - 11:00 AM): ML
Foundations**
```
- Visual introduction to ML concepts using
    diagrams and flowcharts
- Interactive demonstrations of supervised
    vs unsupervised learning
- Resources: 3Blue1Brown Neural Networks
    video series
- No coding yet - pure concept visualization
**Break (11:00 AM - 11:30 AM)**
**Afternoon Session (1:00 PM - 3:00 PM):
    Python for ML**
- Visual Python review: data structures with
    matplotlib plots
- NumPy array operations with visual matrix
    representations
- Pandas DataFrames with real datasets and
    visualization
       - Hands-on: Jupyter notebook with embedded
          plots
       - Resources: Python Data Science Handbook
          (visual chapters)
       **Evening (5:00 PM - 7:00 PM): Optional
          practice**
       - Self-paced exercises with visual feedback
       - Prepare environment for Day 2
       This structure honors your 120-minute focus
          blocks and emphasizes visual learning
          throughout. Each session includes
          diagrams, plots, and visual
          demonstrations rather than pure
          text.</answer>

```
Analysis: The trained agent uses RE-
TRIEVE_MEMORY to access stored user
preferences from LTM, then synthesizes this
information with the current task to generate a
highly personalized response that respects the
120-minute session duration and emphasizes visual
learning resources. The integration of retrieved
memory with task execution produces superior,
context-aware outputs compared to the baseline’s
generic approach.
```
```
Summary. These three cases demonstrate how
AgeMem’s three-stage progressive training enables
agents to develop sophisticated memory manage-
ment strategies. Case 1 shows selective stor-
age and maintenance of long-term knowledge
through ADD_MEMORY, UPDATE_MEMORY, and
DELETE_MEMORY. Case 2 illustrates proac-
tive short-term context control under distraction
via FILTER_CONTEXT and SUMMARY_CONTEXT.
Case 3 demonstrates the integration of these capa-
bilities, where RETRIEVE_MEMORY enables the
agent to access stored knowledge and coordinate
memory systems to solve tasks effectively. In
each case, the RL-trained agent significantly out-
performs the baseline by learning when and how
to apply memory tools, resulting in more focused,
consistent, and personalized interactions.
```
## C Experimental Implementation

```
C.1 Dataset Details
We provide detailed statistics and characteristics of
the five datasets used in our experiments:
ALFWorld (Shridhar et al., 2020) is an embod-
ied AI benchmark in which agents must complete
household tasks by following natural language in-
structions in a simulated environment. The dataset
consists of several thousand training environments
```

and multiple validation and test splits, covering six
task types: pick and place, examine in light, clean
and place, heat and place, cool and place, and pick
two and place. These tasks require long-horizon
interaction with objects, making ALFWorld well
suited for evaluating planning and memory man-
agement capabilities.
SciWorld (Wang et al., 2022) is an interactive sci-
ence experiment simulation environment where
agents must perform multi-step experiments to
answer scientific questions. The benchmark in-
cludes a diverse set of tasks spanning multiple
scientific domains, such as physics, chemistry,
and biology, and emphasizes procedural reasoning
and hypothesis-driven exploration. Its complexity
makes it suitable for testing an agent’s ability to re-
tain and retrieve relevant knowledge over extended
interaction sequences.
PDDL (Chang et al., 2024) refers to a set of plan-
ning benchmarks formulated using the Planning
Domain Definition Language. These benchmarks
evaluate an agent’s ability to solve symbolic plan-
ning problems across multiple domains by gener-
ating valid sequences of actions that achieve speci-
fied goal states. The tasks primarily test structured
reasoning and the ability to maintain and utilize
intermediate planning states.
BabyAI (Chevalier-Boisvert et al., 2018) is a grid-
world navigation benchmark with natural language
instructions. The environment contains a large
collection of instruction-following tasks (levels),
where agents must navigate and interact with ob-
jects to satisfy compositional language commands.
Due to its sequential decision-making structure,
BabyAI is commonly used to evaluate short-term
context tracking and instruction grounding.
HotpotQA (Yang et al., 2018) is a multi-hop ques-
tion answering dataset that requires reasoning over
multiple Wikipedia paragraphs. It contains approxi-
mately 90k training questions along with validation
and test splits, and each question is annotated with
supporting facts. This structure makes HotpotQA
particularly suitable for evaluating long-term mem-
ory storage and retrieval. In our experiments, we
use HotpotQA for reinforcement learning training,
as its annotated supporting facts naturally provide
structured contextual information for Stage 1 su-
pervision.

```
C.2 LLM-based Evaluation Details
For the Memory Quality (MQ) metric, we employ
an LLM-based evaluator to assess the quality of
```
```
supporting facts stored in memory by comparing
predicted supporting facts with ground-truth ex-
pected facts. The evaluator uses the following
prompt template:

You are an expert judge evaluating the quality
of supporting facts for question answering.
Question: [QUESTION]
Answer: [ANSWER]
Ground Truth Supporting Facts (the facts that
should be identified):
Expected Supporting Facts:
```
- [FACT_1]
- [FACT_2]
...
Model Predicted Supporting Facts (the facts
    identified by the model and stored in the
    long-term memory):
Predicted Supporting Facts:
- [PREDICTED_FACT_1]
- [PREDICTED_FACT_2]
...
Please evaluate how well the predicted
    supporting facts match the ground truth
    expected facts:
1. Are all expected facts covered by the
    predictions?
2. Are the predicted facts actually relevant to
    answering the question?
3. Are there any irrelevant facts in the
    predictions?
Score on a scale of 0.0 to 1.0:
- 1.0: Perfect match - all expected facts are
    correctly identified, no irrelevant facts
- 0.8-0.9: Mostly correct with minor omissions
    or one irrelevant fact
- 0.6-0.7: Partially correct - some relevant
    facts identified but missing important ones
- 0.4-0.5: Some correct elements but significant
    errors or omissions
- 0.2-0.3: Mostly incorrect with few correct
    elements
- 0.0-0.1: Completely incorrect or irrelevant
Respond with only a number between 0.0 and 1.0 (
    e.g., "0.85").

```
The evaluator compares the stored memory en-
tries (predicted supporting facts) with the ground-
truth supporting facts provided in the HotpotQA
dataset. The score reflects both the coverage of
expected facts and the relevance of predicted facts
to the question. We use Qwen-Max as the evaluator
model, and each evaluation is performed indepen-
dently to ensure consistency.
For the LLM-as-a-Judge metric on HotpotQA,
we use a similar approach, where Qwen-Max eval-
uates the correctness of the agent’s answer by com-
paring it with the ground-truth answer. The evalua-
```

tor uses the following prompt template:

You are an expert judge evaluating the
correctness of answers to questions.
Given the following information:

- Question: [QUESTION]
- Ground-truth Answer: [GROUND_TRUTH]
- Agent’s Answer: [AGENT_ANSWER]
Please evaluate the generated answer on a scale
    of 0.0 to 1.0:
- 1.0: Perfect match or equivalent correct
    answer
- 0.8-0.9: Mostly correct with minor differences
- 0.6-0.7: Partially correct or close
    approximation
- 0.4-0.5: Some correct elements but significant
    errors
- 0.2-0.3: Mostly incorrect with few correct
    elements
- 0.0-0.1: Completely incorrect or irrelevant
Respond with only a number between 0.0 and 1.0 (
    e.g., "0.85").

```
C.3 Baseline Configurations
All baseline implementations follow their respec-
tive official open-source codebases to ensure fair
comparison. We provide the source links and im-
plementation details below.
LangMem (LangChain Team, 2025): We use
the official implementation available athttps:
//langchain-ai.github.io/langmem/with de-
fault hyperparameters. LangMem employs a modu-
lar memory framework that supports multiple mem-
ory types. We configure it to use the default mem-
ory storage and retrieval mechanisms as specified
in the official documentation.
A-Mem (Xu et al., 2025): We implement A-
Mem following the Zettelkasten-inspired design
described in the original paper, using the official
codebase at https://github.com/WujiangXu/
A-mem-sys/. The system links structured knowl-
edge units to facilitate consolidation. We use the
recommended hyperparameters for memory con-
solidation as provided in the repository.
Mem0 (Chhikara et al., 2025): We use the of-
ficial Mem0 implementation available athttps:
//github.com/mem0ai/mem0 with the default
extract-update pipeline. For the graph-based vari-
ant (Mem0g), we enable the graph structure option
and use the recommended graph construction pa-
rameters as specified in the official implementation.
AgeMem-noRL: This variant uses the same tool
interface as AgeMem but without reinforcement
learning. This baseline helps isolate the contribu-
tion of RL training to the overall performance.
```
```
RAG variants: For the RAG-based baselines
(AgeMem-noRL-RAG and AgeMem-RAG), we re-
place the STM tools with a standard RAG pipeline
that retrieves relevant memories at each step and
appends them to the context. The retrieval is per-
formed using cosine similarity between the current
context and stored memories, following standard
RAG practices. This comparison demonstrates the
advantage of learned STM management over static
retrieval-based approaches.
```
```
C.4 Implementation Details
Training configuration. We use the Trinity RL
framework (Pan et al., 2025a) for policy optimiza-
tion, implementing the step-wise GRPO algorithm
as described in the method section. We useK = 8
independent rollouts per task for group normaliza-
tion. The KL divergence coefficientβis set to 0.1.
Reward weights. All reward weights are set to 1/3:
wtask= wcontext= wmemory= 1/ 3. This uniform
weighting ensures that all components contribute
equally to the learning signal, allowing the agent
to naturally balance task performance and memory
management.
Model settings. The maximum context length is
set to 8,192 tokens, and the maximum response
length is set to 2,048 tokens. When the context
exceeds this limit, the agent receives a penalty, en-
couraging proactive use of STM management tools.
All experiments are conducted on 8 NVIDIA RTX
4090 GPUs with 48GB memory each.
```
## D Additional Results

```
D.1 Ablation Study
This section provides complementary ablation
study results for Qwen3-4B-Instruct. Figure 9
shows the progressive contribution of LTM, STM,
and RL components on Qwen3-4B-Instruct across
three representative datasets. The results demon-
strate consistent trends with Qwen2.5-7B-Instruct,
validating the generalizability of our approach
across different model sizes.
```
```
D.2 Reward Function Ablation on Qwen3-4B
To validate the generalizability of our multi-
component reward design across different model
architectures and scales, we conduct the same re-
ward function ablation study as in the main text on
Qwen3-4B-Instruct. This section provides a com-
plete analysis parallel to the Qwen2.5-7B-Instruct
results presented in the main paper.
```

```
Base +LT +LT/RL+LT/ST/RL
(a) ALFWorld
```
```
0
```
```
20
```
```
40
```
```
60
```
```
Performance Score
```
```
38.51 42.09
+3.6
```
```
44.37
+5.9
```
```
48.97
+10.5
```
```
Base +LT +LT/RL+LT/ST/RL
(b) SciWorld
```
```
0
```
```
20
```
```
40
```
```
60
47.89 43.50
-4.4
```
```
57.21
+9.3
```
```
59.48
+11.6
```
```
Base +LT +LT/RL+LT/ST/RL
(c) HotpotQA
```
```
0
```
```
20
```
```
40
```
```
60
47.48
53.16
+5.7
```
```
54.58
+7.1
```
```
55.49
+8.0
```
```
Figure 9: Ablation study results for Qwen3-4B-Instruct. Base: No-Memory baseline; +LT: AgeMem-noRL-RAG
(LTM tools only); +LT/RL: AgeMem-RAG (RL with LTM tools); +LT/ST/RL: AgeMem (full AgeMem system
with RL). Green arrows indicate performance gains over the baseline.
```
```
0 20 40 60 80 100
Training Step
```
```
0.0
```
```
0.2
```
```
0.4
```
```
0.6
```
```
0.8
```
```
1.0
```
```
Average Reward
```
```
Qwen3-4B - GRPO Training Reward Convergence
```
```
All Returns
Answer-Only
```
```
Figure 10: Training convergence curves on Qwen3-4B-
Instruct comparing All-Returns (solid line) v.s. Answer-
Only (dashed line) reward strategies.
```
```
D.2.1 Convergence Analysis
Figure 10 demonstrates the reward convergence pat-
terns on Qwen3-4B-Instruct. Similar to Qwen2.5-
7B-Instruct, the All-Returns strategy consistently
outperforms Answer-Only throughout the training
process. Several notable observations emerge:
More Stable Dynamics: The convergence
curve shows noticeably smoother progression with
lower variance, particularly in the later training
stages (steps 70-100). This stability suggests that
Qwen3’s architecture may have better inductive
biases for the reward learning task.
Consistent Superiority: While the absolute im-
provement is smaller than Qwen2.5-7B-Instruct,
the All-Returns strategy maintains its advantage
throughout training, validating the robustness of
our reward design.
```
D.2.2 Quantitative Results
Table 5 reports the reward ablation results on Hot-
potQA with Qwen3-4B-Instruct. Compared to the
Answer-Only strategy, the All-Returns reward con-
sistently improves overall performance. In particu-
lar, it yields higher LLM-as-a-Judge scores (0.555

```
Table 5: Reward function ablation results on HotpotQA
using Qwen3-4B-Instruct. All-Returns v.s. Answer-
Only reward strategies. “TN” is the token number, and
“TC” denotes the number of tool calls.
```
```
Strategy J(↑) TN(↓) MQ(↑) TC(-)
Answer-Only 0.546 2164 0.415 7.21
All-Returns 0.555 2191 0.605 8.67
```
```
v.s. 0.546) and substantially better memory quality
(MQ: 0.605 v.s. 0.415), indicating that explicitly
rewarding memory-related behaviors leads to more
reliable memory organization. The All-Returns
strategy also encourages more active tool usage
(8.67 v.s. 7.21), suggesting that the agent learns
to leverage memory operations more effectively
when intermediate returns are optimized. This im-
provement comes with only a marginal increase
in token consumption (2191 v.s. 2164), implying
that the gains are not driven by excessive context
expansion but by more efficient memory utiliza-
tion. Overall, these results show that incorporating
memory-aware rewards significantly enhances both
memory quality and task performance on Qwen3-
4B-Instruct. The observed trends are consistent
with those obtained on Qwen2.5-7B-Instruct, con-
firming the robustness of the reward design across
different model backbones.
```

