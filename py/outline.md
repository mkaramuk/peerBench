# Assumptions 
- We want to be compatible with closed soruce systems/  If someone wants their opensoruce model valdiatred they can just put it into openrouter or anyother host  and list it like that 


# Validator functional componenets 
- SDK framework that makes it easy for different AI model providers to add a plugin for their specific API to a generic model type function. For instance a machine tanslation SDK  function will have many adapters for different AI model providers with their different API endpoints and authentication types.  [ Similar to   litellm   https://github.com/BerriAI/litellm
]  {for lazyness we can use openrouter through littlellm so we don't need to go get so many API keys}
- Validators must send each prompt to all providers being tested  simultinaously  they can not do it sequencially.  They can wait for the first prompt to be finished before the next for rate limiting but providers must be prompted simultainously. 
- Each of the validators need to have a place to store all of their API keys for each provider. [can start as env variables but later needs to be some KMS  ]
- Validator registration simply to connect their public key to an organizations  email or domain. 
- Validators decide which providers they want to test this is a simple config. It's a human decision to test people 
- Validator must have the ability to upload scored resposnes. (The validator will have their employees score each resposne in excel or google sheets  ).  The evaluation defines how to aggregate the scores per prompt simple Average or Accuracy or more compelx BLUE score is determined by the Evaluation spec.   
- SDK  helps produce  signed evlaution publications in schema example_evaluation_test_stream_publication.yaml  (these should be submitted within 7 days of the prompt or how ever long the Evaluation Stream stipulates)


# Centralized Information aggregation server 
- API accepting  evaluation JSON   [auth :  pk signature validation checked.  JWS and secp256k1  ]
    -
- API accepting new Evaluation Test Stream description doc [No AUTH required]
    - This could have a very simple web form since not key is needed 
    - AKA Functions that help ai researchers and validators publish new test data creation standards and evaluation methods. 
- API accepting provider saying they want to be tested for a certain Evaluation Test Stream  [auth :  pk signature validation checked ]
    - AKA Function to help AI model providers announce that they want to get benchmarked with fresh data on new test data evaluation streams  
- [later] A background process that checks if one of the API submitted JSON messages was not seen on WAKU gossip then the server should push the message again via waku 
- This server should be designed in a very lean manner such that the JS version can just be a client side wrapper that also calls a local version of this server.  

# Identity  
- We will use decentralized identifiers (DIDs ). To start we'll use a simple   did:key or did:pkh  where we resolve the  endpoint document on our own centralized servers  but while coding we should consider that we will want to support other did mehtods 
    - In general we just agree to use the concept of  a did:string the is the non mutable ID of Validator and there is a document describing more about them like name etc  which must be resolved from some server 
    - We decided that we will run a centralized server ourselves for the resolving extra metadata 
    - [Later]  did:plc   or similar    that allows rotation   and  pubkey is not inside the identity string 

Everything above is  POC/MVP   April 7 2025   deadline  


# Things that can be done in a second step  [Later] (  Release target May 22, 2025 ) 
- Open data publication of all the test data that was used and what answers different models gave (aka the audit log)
- Web UI displays results in aggregate.  
- Distributing registrations and evaluations via WAKU or other open decentralized message bus 
- users/vakidators can   spot check the responses that validators gave by reprompting the provider and checking if they get the same or similar quality response to make sure that the validator is not lying about a provider giving a bad response to a prompt 


# Provider functionality 
-  no real provider code needs to be written.  Providers just run their own API's as they do for regular business. 
