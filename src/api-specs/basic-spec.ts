const port = process.env.PORT || 3000;

const swaggerCommonPart={
    "openapi": "3.0.0",
    "info": {
        "version": "0.0.1",
        "title": "Godspeed: Sample Microservice",
        "description": "Sample API calls demonstrating the functionality of Godspeed framework",
        "termsOfService": "http://swagger.io/terms/",
        "contact": {
            "name": "Mindgrep Technologies Pvt Ltd",
            "email": "talktous@mindgrep.com",
            "url": "https://docs.mindgrep.com/docs/microservices/intro"
        },
        "license": {
            "name": "Apache 2.0",
            "url": "https://www.apache.org/licenses/LICENSE-2.0.html"
        }
    },
    "servers": [{
        "url": `http://localhost:${port}`
    }],
    "paths": {}
};

export default swaggerCommonPart;
