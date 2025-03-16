# Validator functional componenets 
- Validator registration simply to connect their public key to an organizations  email or domain. 
- SDK framework that makes it easy for different AI model providers to add a plugin for their specific API to a generic model type function. For instance a machine tanslation SDK  function will have many adapters for different AI model providers with their different API endpoints and authentication types.  [ Similar to   litellm   https://github.com/BerriAI/litellm
]

# Centralized Information aggregation server 
- API accepting  evaluation JSON   [auth :  pk signature validation checked ]
    - AKA Functions that help a validator publish ai model benchmark results. Results as aggregate statistics 
- API accepting new Evaluation Test Stream description doc [No AUTH required]
    - This could have a very simple web form since not key is needed 
    - AKA Functions that help ai researchers and validators publish new test data creation standards and evaluation methods. 
- API accepting provider saying they want to be tested for a certain Evaluation Test Stream  [auth :  pk signature validation checked ]
    - AKA Function to help AI model providers announce that they want to get benchmarked with fresh data on new test data evaluation streams  
- [later] A background process that checks if one of the API submitted JSON messages was not seen on WAKU gossip then the server should push the message again via waku 
- This server should be designed in a very lean manner such that the JS version can just be a client side wrapper that also calls a local version of this server.  



# Things that can be done in a second step 
- Open data publication of all the test data that was used and what answers different models gave 
- Web UI displays results in aggregate.  
- Distributing registrations and evaluations via WAKU or other open decentralized message bus 