import { loadJsonSchemaForEvents } from '../../../core/jsonSchemaValidation';
import { GSStatus } from '../../../core/interfaces';
import { PlainObject } from '../../../core/common';
const sampleEvents:PlainObject = {
   
  "/v1/loan-application.http.post": {
    "fn": "com.biz.loan_application.create_loan_application",
    "id": "/createLoanApplication",
    "data": {
        "schema": {
            "body": {
                "required": true,
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "required": [
                                "name",
                                "mobile_number",
                                "gender",
                                "dob",
                                "pan_number"
                            ],
                            "properties": {
                                "uuid": {
                                    "type": "string",
                                    "maxLength": 22,
                                    "minLength": 22
                                },
                                "loan_application_id": {
                                    "type": "string"
                                },
                                "borrower_id": {
                                    "type": "string"
                                },
                                "mobile_number": {
                                    "type": "string",
                                    "minLength": 10,
                                    "maxLength": 10,
                                    "pattern": "^[0-9]{10}$"
                                },
                                "email": {
                                    "type": "string",
                                    "format": "email"
                                },
                                "name": {
                                    "type": "string"
                                },
                                "consent": {
                                    "type": "boolean"
                                },
                                "consent_otp": {
                                    "type": "number"
                                },
                                "loan_purpose": {
                                    "type": "string"
                                },
                                "gender": {
                                    "type": "string"
                                },
                                "dob": {
                                    "type": "string",
                                    "format": "date",
                                    "pattern": "[0-9]{4}-[0-9]{2}-[0-9]{2}"
                                },
                                "pan_number": {
                                    "type": "string",
                                    "pattern": "[A-Z]{5}[0-9]{4}[A-Z]{1}"
                                },
                                "permanent_address": {
                                    "type": "object",
                                    "required": [],
                                    "properties": {
                                        "address_line1": {
                                            "type": "string"
                                        },
                                        "address_line2": {
                                            "type": "string"
                                        },
                                        "landmark": {
                                            "type": "string"
                                        },
                                        "pincode": {
                                            "type": "number"
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    "responses": {
        "200": {
            "examples": {
                "schema": {
                    "data": {
                        "description": "",
                        "required": false,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "application_id": {
                                            "type": "string"
                                        },
                                        "additionalProperties": false,
                                        "required": [
                                            "application_id"
                                        ]
                                    }
                                },
                                "examples": {
                                    "example1": {
                                        "summary": "",
                                        "description": "",
                                        "value": {
                                            "application_id": "PRM20478956N",
                                            "external_value": "",
                                        }
                                    },
                                    "  encoding": {}
                                }
                            }
                        }
                    }
                }
            }
        },
        "400": {
            "examples": {
                "schema": {
                    "data": {
                        "description": "",
                        "required": false,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "lender_response_code": {
                                            "type": "string"
                                        },
                                        "additionalProperties": false,
                                        "required": [
                                            "application_id"
                                        ]
                                    }
                                },
                                "examples": {
                                    "example1": {
                                        "summary": "",
                                        "description": "",
                                        "value": {
                                            "lender_response_code": "E001",
                                            "external_value": ""
                                        }
                                    },
                                    "  encoding": {}
                                }
                            }
                        }
                    }
                }
            }
        }
    }
},
    "/v1/loan-application/:lender_loan_application_id.http.patch": {
      "id": "/loanApplicationUpdate",
      "fn": "com.biz.loan_application.update_loan_application",
      "data": {
        "schema": {
          "body": {
            "type": "object",
            "required": ["stage"],
            "properties": {
              "stage": { "type": "string" },
              "bank_statement_availability": { "type" : ["bool", "null"] },
              "nach_details": {
                "type": "object",
                "required": [],
                "properties": {
                  "umrn": {
                    "type": "string",
                    "nullable": true
                  }
                }
              }
            }
          },
          "params": [
            {
              "name": "lender_loan_application_id",
              "in": "params",
              "required": true,
              "allow_empty_value": false,
              "schema": {
                "type": "string",
                "nullable": true
              }
            },
            {
              "name":"bank_id",
              "in":"query",
              "required":true,
              "allow_empty_value": false,
              "schema": {
                "type": "string",
                "nullable": true
              }
              
            }
          ]
        }
      }
    }
  }
loadJsonSchemaForEvents(sampleEvents)
const date = new Date('2022-05-11');
const status = new GSStatus(
    true,
    200,
    '/v1/loan-application.http.post',
         {
            "application_id": "PRM20478956N"              
            }
        
)
const topic ='/v1/loan-application.http.post'
export { topic, status };