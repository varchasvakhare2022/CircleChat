# Circlechat Frontend


> **API Documentation** | Generated on 2026-06-08 14:46:02

---

# Circlechat Frontend Documentation

---

## 1. Overview

* **API Name:** Circlechat Frontend
* **Purpose / Business Value:** The Circlechat Frontend API provides endpoints for user management, group interactions, and message handling within a chat application.
* **Base URL:** `None`
* **API Version:** v1
* **Supported Formats:** JSON
* **Detected Frameworks:** Flask
* **Total Endpoints:** 17
* **Last Updated:** 2026-06-08 14:46:02

### Key Features

* User profile management
* Group messaging
* Real-time updates
* Health check endpoint

### Endpoint Distribution

| Method | Count | Description |
|--------|-------|-------------|
| `GET` | 9 | Data retrieval, validation operations |
| `POST` | 3 | Submit data and execute operations |
| `PUT` | 2 | Resource updates |
| `DELETE` | 2 | Resource removal, resource updates |

---

## 2. Authentication & Authorization

* **Authentication Type:** Bearer Token
* **How to Obtain Credentials:** Users can obtain a token by logging in through the authentication endpoint.
* **How to Pass Credentials:** Header

### Authentication Endpoints

* `POST /auth/login` - User login

**Example Header:**

```
Authorization: Bearer <token>
```

---

## 3. Common Headers

The following headers are commonly used across all endpoints:

| Header | Required | Description |
|:-------|:--------:|:------------|
| Authorization | Yes | Auth token |
| Content-Type | Yes | application/json |

---

## 4. Error Handling

| Status Code | Meaning |
|:-----------:|:--------|
| 200 | Success |
| 400 | Bad Request |
| 401 | Unauthorized |
| 500 | Internal Server Error |

**Error Response Format:**

```json
{
  "status": 400,
  "message": "Error message",
  "data": null
}
```

### Common Error Types

| Error Code | Description |
|:----------:|:------------|
| `VALIDATION_ERROR` | Input validation failed |
| `DATABASE_ERROR` | Database not connected |

---

## 5. Resource Endpoints

### Accepts

#### POST – Create Resource

*Create operations using the POST method*

#### Accept Invite

**Method:** POST
**Endpoint:** `/{invite_code}/accept`

**Description:** This endpoint allows a user to accept an invitation to join a group using a unique invite code.

**Request Headers:**

| Header | Required | Value |
|:-------|:--------:|:------|
| Authorization | Yes | Token |

**Path Parameters:**

| Parameter | Type | Required | Description |
|:----------|:----:|:--------:|:------------|
| `invite_code` | string | Yes | Resource identifier |

**Response**

**Status Code:** `200 OK`

```json
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "example": "example_message"
    },
    "group_id": {
      "type": "string",
      "example": "20"
    }
  }
}
```

**Possible Status Codes:**

| Status Code | Scenario | Description |
|:------------|:---------|:------------|
| `200` | Successful request | Successful request |
| `400` | Bad request - invalid input parameters | Source: FastAPI |
| `404` | Resource not found | Source: FastAPI |
| `410` | HTTP 410 response | Source: FastAPI |
| `500` | Internal server error | Source: FastAPI |


**Response Examples by Status Code:**

**200 OK:**
```json
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "example": "example_message"
    },
    "group_id": {
      "type": "string",
      "example": "20"
    }
  }
}
```

**400 Bad Request:**
```json
{
  "error": "Error 400: Bad Request",
  "status_code": 400
}
```

**404 Not Found:**
```json
{
  "error": "Error 404: Not Found",
  "status_code": 404
}
```

**410 :**
```json
{
  "error": "Error 410: ",
  "status_code": 410
}
```

**500 Internal Server Error:**
```json
{
  "error": "Error 500: Internal Server Error",
  "status_code": 500
}
```


**Code Examples:**

**cURL:**
```bash
curl -X POST '/{invite_code}/accept' \
  -H 'Authorization: Token <token> YOUR_TOKEN'
```

**Python (requests):**
```python
import requests

url = '/{invite_code}/accept'
headers = {
    'Authorization': 'Token <token> YOUR_TOKEN',
}

response = requests.post(url, headers=headers)
print(response.json())
```

**JavaScript (fetch):**
```javascript
const url = '/{invite_code}/accept';
const options = {
  method: 'POST',
  headers: {
    'Authorization': 'Token <token> YOUR_TOKEN',
  }
};

fetch(url, options)
  .then(response => response.json())
  .then(data => console.log(data));
```

---

*Source: `backend/app/routes/invites.py`*

### Healths

#### GET – Fetch Resource

*Retrieve operations using the GET method*

#### Health

**Method:** GET
**Endpoint:** `/health`

🔄 **Idempotent:** This operation is idempotent - multiple identical requests have the same effect as a single request.

**Description:** The /health endpoint is designed to provide a quick health check for the service, indicating whether it is operational.

**Request Headers:**

| Header | Required | Value |
|:-------|:--------:|:------|
| Authorization | Yes | Token |

**Response**

**Status Code:** `200 OK`

```json
{
  "type": "object",
  "properties": {
    "status": {
      "type": "string",
      "example": "example_status"
    }
  }
}
```

**Code Examples:**

**cURL:**
```bash
curl -X GET '/health' \
  -H 'Authorization: Token <token> YOUR_TOKEN'
```

**Python (requests):**
```python
import requests

url = '/health'
headers = {
    'Authorization': 'Token <token> YOUR_TOKEN',
}

response = requests.get(url, headers=headers)
print(response.json())
```

**JavaScript (fetch):**
```javascript
const url = '/health';
const options = {
  method: 'GET',
  headers: {
    'Authorization': 'Token <token> YOUR_TOKEN',
  }
};

fetch(url, options)
  .then(response => response.json())
  .then(data => console.log(data));
```

---

*Source: `backend/app/main.py`*

### Joins

#### POST – Create Resource

*Create operations using the POST method*

#### Join Group

**Method:** POST
**Endpoint:** `/{group_id}/join`

🔔 **Webhook:** This endpoint receives webhook callbacks.

**Description:** This endpoint allows a user to join a specific group identified by the group_id.

**Request Headers:**

| Header | Required | Value |
|:-------|:--------:|:------|
| Authorization | Yes | Token |

**Path Parameters:**

| Parameter | Type | Required | Description |
|:----------|:----:|:--------:|:------------|
| `group_id` | integer (long) | Yes | Resource identifier |

**Response**

**Status Code:** `200 OK`

```json
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "example": "example_message"
    },
    "group_id": {
      "type": "string",
      "example": "20"
    }
  }
}
```

**Possible Status Codes:**

| Status Code | Scenario | Description |
|:------------|:---------|:------------|
| `200` | Successful request | Successful request |
| `400` | Bad request - invalid input parameters | Source: FastAPI |
| `404` | Resource not found | Source: FastAPI |
| `500` | Internal server error | Source: FastAPI |


**Response Examples by Status Code:**

**200 OK:**
```json
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "example": "example_message"
    },
    "group_id": {
      "type": "string",
      "example": "20"
    }
  }
}
```

**400 Bad Request:**
```json
{
  "error": "Error 400: Bad Request",
  "status_code": 400
}
```

**404 Not Found:**
```json
{
  "error": "Error 404: Not Found",
  "status_code": 404
}
```

**500 Internal Server Error:**
```json
{
  "error": "Error 500: Internal Server Error",
  "status_code": 500
}
```


**Code Examples:**

**cURL:**
```bash
curl -X POST '/{group_id}/join' \
  -H 'Authorization: Token <token> YOUR_TOKEN'
```

**Python (requests):**
```python
import requests

url = '/{group_id}/join'
headers = {
    'Authorization': 'Token <token> YOUR_TOKEN',
}

response = requests.post(url, headers=headers)
print(response.json())
```

**JavaScript (fetch):**
```javascript
const url = '/{group_id}/join';
const options = {
  method: 'POST',
  headers: {
    'Authorization': 'Token <token> YOUR_TOKEN',
  }
};

fetch(url, options)
  .then(response => response.json())
  .then(data => console.log(data));
```

---

*Source: `backend/app/routes/groups.py`*

### Leaves

#### DELETE – Remove Resource

*Delete operations using the DELETE method*

#### Leave Group

**Method:** DELETE
**Endpoint:** `/{group_id}/leave`

🔄 **Idempotent:** This operation is idempotent - multiple identical requests have the same effect as a single request.

**Description:** This DELETE endpoint allows a user to leave a specified group by its ID.

**Request Headers:**

| Header | Required | Value |
|:-------|:--------:|:------|
| Authorization | Yes | Token |

**Path Parameters:**

| Parameter | Type | Required | Description |
|:----------|:----:|:--------:|:------------|
| `group_id` | integer (long) | Yes | Resource identifier |

**Query Parameters:**

| Name | Type | Required | Description |
|:-----|:----:|:--------:|:------------|
| `user_id` | string | No | Query parameter |
| `db` | string | No | Query parameter |

**Response**

**Status Code:** `200 OK`

```json
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "example": "example_message"
    }
  }
}
```

**Possible Status Codes:**

| Status Code | Scenario | Description |
|:------------|:---------|:------------|
| `200` | Successful request | Successful request |
| `400` | Bad request - invalid input parameters | Source: FastAPI |
| `403` | Forbidden - insufficient permissions | Source: FastAPI |
| `404` | Resource not found | Source: FastAPI |
| `500` | Internal server error | Source: FastAPI |


**Response Examples by Status Code:**

**200 OK:**
```json
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "example": "example_message"
    }
  }
}
```

**400 Bad Request:**
```json
{
  "error": "Error 400: Bad Request",
  "status_code": 400
}
```

**403 Forbidden:**
```json
{
  "error": "Error 403: Forbidden",
  "status_code": 403
}
```

**404 Not Found:**
```json
{
  "error": "Error 404: Not Found",
  "status_code": 404
}
```

**500 Internal Server Error:**
```json
{
  "error": "Error 500: Internal Server Error",
  "status_code": 500
}
```


**Code Examples:**

**cURL:**
```bash
curl -X DELETE '/{group_id}/leave' \
  -H 'Authorization: Token <token> YOUR_TOKEN'
```

**Python (requests):**
```python
import requests

url = '/{group_id}/leave'
headers = {
    'Authorization': 'Token <token> YOUR_TOKEN',
}

response = requests.delete(url, headers=headers)
print(response.json())
```

**JavaScript (fetch):**
```javascript
const url = '/{group_id}/leave';
const options = {
  method: 'DELETE',
  headers: {
    'Authorization': 'Token <token> YOUR_TOKEN',
  }
};

fetch(url, options)
  .then(response => response.json())
  .then(data => console.log(data));
```

---

*Source: `backend/app/routes/groups.py`*

### Members

#### DELETE – Remove Resource

*Delete operations using the DELETE method*

#### Remove Member

**Method:** DELETE
**Endpoint:** `/{group_id}/members/{member_id}`

🔄 **Idempotent:** This operation is idempotent - multiple identical requests have the same effect as a single request.

**Description:** This DELETE endpoint is designed to remove a member from a specified group, with the primary use case being group management by the owner.

**Request Headers:**

| Header | Required | Value |
|:-------|:--------:|:------|
| Authorization | Yes | Token |

**Path Parameters:**

| Parameter | Type | Required | Description |
|:----------|:----:|:--------:|:------------|
| `group_id` | integer (long) | Yes | Resource identifier |
| `member_id` | integer (long) | Yes | Resource identifier |

**Query Parameters:**

| Name | Type | Required | Description |
|:-----|:----:|:--------:|:------------|
| `user_id` | string | No | Query parameter |
| `db` | string | No | Query parameter |

**Response**

**Status Code:** `200 OK`

```json
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "example": "example_message"
    }
  }
}
```

**Possible Status Codes:**

| Status Code | Scenario | Description |
|:------------|:---------|:------------|
| `200` | Successful request | Successful request |
| `400` | Bad request - invalid input parameters | Source: FastAPI |
| `403` | Forbidden - insufficient permissions | Source: FastAPI |
| `404` | Resource not found | Source: FastAPI |
| `500` | Internal server error | Source: FastAPI |


**Response Examples by Status Code:**

**200 OK:**
```json
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "example": "example_message"
    }
  }
}
```

**400 Bad Request:**
```json
{
  "error": "Error 400: Bad Request",
  "status_code": 400
}
```

**403 Forbidden:**
```json
{
  "error": "Error 403: Forbidden",
  "status_code": 403
}
```

**404 Not Found:**
```json
{
  "error": "Error 404: Not Found",
  "status_code": 404
}
```

**500 Internal Server Error:**
```json
{
  "error": "Error 500: Internal Server Error",
  "status_code": 500
}
```


**Code Examples:**

**cURL:**
```bash
curl -X DELETE '/{group_id}/members/{member_id}' \
  -H 'Authorization: Token <token> YOUR_TOKEN'
```

**Python (requests):**
```python
import requests

url = '/{group_id}/members/{member_id}'
headers = {
    'Authorization': 'Token <token> YOUR_TOKEN',
}

response = requests.delete(url, headers=headers)
print(response.json())
```

**JavaScript (fetch):**
```javascript
const url = '/{group_id}/members/{member_id}';
const options = {
  method: 'DELETE',
  headers: {
    'Authorization': 'Token <token> YOUR_TOKEN',
  }
};

fetch(url, options)
  .then(response => response.json())
  .then(data => console.log(data));
```

---

*Source: `backend/app/routes/groups.py`*

### Mes

#### GET – Fetch Resource

*Retrieve operations using the GET method*

#### Get Profile

**Method:** GET
**Endpoint:** `/me`

🔄 **Idempotent:** This operation is idempotent - multiple identical requests have the same effect as a single request.

**Description:** The GET /me endpoint retrieves the profile information of the currently authenticated user.

**Request Headers:**

| Header | Required | Value |
|:-------|:--------:|:------|
| Authorization | Yes | Token |

**Query Parameters:**

| Name | Type | Required | Description |
|:-----|:----:|:--------:|:------------|
| `user_id` | string | No | Query parameter |
| `db` | string | No | Query parameter |

**Response**

**Status Code:** `200 OK`

```json
{
  "type": "object",
  "properties": {
    "user_id": {
      "type": "string",
      "example": "20"
    },
    "display_name": {
      "type": "string",
      "example": "English"
    }
  }
}
```

**Possible Status Codes:**

| Status Code | Scenario | Description |
|:------------|:---------|:------------|
| `200` | Successful request | Successful request |
| `500` | Internal server error | Source: FastAPI |


**Response Examples by Status Code:**

**200 OK:**
```json
{
  "type": "object",
  "properties": {
    "user_id": {
      "type": "string",
      "example": "20"
    },
    "display_name": {
      "type": "string",
      "example": "English"
    }
  }
}
```

**500 Internal Server Error:**
```json
{
  "error": "Error 500: Internal Server Error",
  "status_code": 500
}
```


**Code Examples:**

**cURL:**
```bash
curl -X GET '/me' \
  -H 'Authorization: Token <token> YOUR_TOKEN'
```

**Python (requests):**
```python
import requests

url = '/me'
headers = {
    'Authorization': 'Token <token> YOUR_TOKEN',
}

response = requests.get(url, headers=headers)
print(response.json())
```

**JavaScript (fetch):**
```javascript
const url = '/me';
const options = {
  method: 'GET',
  headers: {
    'Authorization': 'Token <token> YOUR_TOKEN',
  }
};

fetch(url, options)
  .then(response => response.json())
  .then(data => console.log(data));
```

---

*Source: `backend/app/routes/users.py`*

#### PUT – Replace Resource

*Replace operations using the PUT method*

#### Update Profile

**Method:** PUT
**Endpoint:** `/me`

🔄 **Idempotent:** This operation is idempotent - multiple identical requests have the same effect as a single request.

**Description:** The PUT /me endpoint is designed to update the current user's profile information, specifically their display name.

**Request Headers:**

| Header | Required | Value |
|:-------|:--------:|:------|
| Authorization | Yes | Token |

**Response**

**Status Code:** `200 OK`

```json
{
  "type": "object",
  "properties": {
    "user_id": {
      "type": "string",
      "example": "20"
    },
    "display_name": {
      "type": "string",
      "example": "English"
    }
  }
}
```

**Possible Status Codes:**

| Status Code | Scenario | Description |
|:------------|:---------|:------------|
| `200` | Successful request | Successful request |
| `400` | Bad request - invalid input parameters | Source: FastAPI |
| `500` | Internal server error | Source: FastAPI |


**Response Examples by Status Code:**

**200 OK:**
```json
{
  "type": "object",
  "properties": {
    "user_id": {
      "type": "string",
      "example": "20"
    },
    "display_name": {
      "type": "string",
      "example": "English"
    }
  }
}
```

**400 Bad Request:**
```json
{
  "error": "Error 400: Bad Request",
  "status_code": 400
}
```

**500 Internal Server Error:**
```json
{
  "error": "Error 500: Internal Server Error",
  "status_code": 500
}
```


**Code Examples:**

**cURL:**
```bash
curl -X PUT '/me' \
  -H 'Authorization: Token <token> YOUR_TOKEN'
```

**Python (requests):**
```python
import requests

url = '/me'
headers = {
    'Authorization': 'Token <token> YOUR_TOKEN',
}

response = requests.put(url, headers=headers)
print(response.json())
```

**JavaScript (fetch):**
```javascript
const url = '/me';
const options = {
  method: 'PUT',
  headers: {
    'Authorization': 'Token <token> YOUR_TOKEN',
  }
};

fetch(url, options)
  .then(response => response.json())
  .then(data => console.log(data));
```

---

*Source: `backend/app/routes/users.py`*

### Messages

#### GET – Fetch Resource

*Retrieve operations using the GET method*

#### Get Messages

**Method:** GET
**Endpoint:** `/{group_id}/messages`

🔄 **Idempotent:** This operation is idempotent - multiple identical requests have the same effect as a single request.

**Description:** Get messages for a group

**Request Headers:**

| Header | Required | Value |
|:-------|:--------:|:------|
| Authorization | Yes | Token |

**Path Parameters:**

| Parameter | Type | Required | Description |
|:----------|:----:|:--------:|:------------|
| `group_id` | integer (long) | Yes | Resource identifier |

**Query Parameters:**

| Name | Type | Required | Description |
|:-----|:----:|:--------:|:------------|
| `limit` | string | No | Query parameter |
| `offset` | string | No | Query parameter |
| `user_id` | string | No | Query parameter |
| `db` | string | No | Query parameter |

**Response**

**Status Code:** `200 OK`

```json
[
  {
    "id": 1,
    "name": "Example messages 1"
  },
  {
    "id": 2,
    "name": "Example messages 2"
  }
]
```

**Pagination:**

Style: Cursor-based

Parameters:
- `cursor` (string) - Cursor for pagination

Response Format:
```json
{
  "results": [],
  "next": null,
  "previous": null
}
```

**Possible Status Codes:**

| Status Code | Scenario | Description |
|:------------|:---------|:------------|
| `200` | Successful request | Successful request |
| `400` | Bad request - invalid input parameters | Source: FastAPI |
| `403` | Forbidden - insufficient permissions | Source: FastAPI |
| `500` | Internal server error | Source: FastAPI |


**Response Examples by Status Code:**

**400 Bad Request:**
```json
{
  "error": "Error 400: Bad Request",
  "status_code": 400
}
```

**403 Forbidden:**
```json
{
  "error": "Error 403: Forbidden",
  "status_code": 403
}
```

**500 Internal Server Error:**
```json
{
  "error": "Error 500: Internal Server Error",
  "status_code": 500
}
```


**Code Examples:**

**cURL:**
```bash
curl -X GET '/{group_id}/messages' \
  -H 'Authorization: Token <token> YOUR_TOKEN'
```

**Python (requests):**
```python
import requests

url = '/{group_id}/messages'
headers = {
    'Authorization': 'Token <token> YOUR_TOKEN',
}

response = requests.get(url, headers=headers)
print(response.json())
```

**JavaScript (fetch):**
```javascript
const url = '/{group_id}/messages';
const options = {
  method: 'GET',
  headers: {
    'Authorization': 'Token <token> YOUR_TOKEN',
  }
};

fetch(url, options)
  .then(response => response.json())
  .then(data => console.log(data));
```

---

*Source: `backend/app/routes/groups.py`*

#### POST – Create Resource

*Create operations using the POST method*

#### Send Message

**Method:** POST
**Endpoint:** `/{group_id}/messages`

**Description:** This endpoint allows users to send messages to a specific group identified by the group_id.

**Request Headers:**

| Header | Required | Value |
|:-------|:--------:|:------|
| Authorization | Yes | Token |

**Path Parameters:**

| Parameter | Type | Required | Description |
|:----------|:----:|:--------:|:------------|
| `group_id` | integer (long) | Yes | Resource identifier |

**Response**

**Status Code:** `200 OK`

```json
{
  "type": {
    "id": 1,
    "name": "Sample type"
  },
  "properties": "sample_properties"
}
```

**Possible Status Codes:**

| Status Code | Scenario | Description |
|:------------|:---------|:------------|
| `200` | Successful request | Successful request |
| `400` | Bad request - invalid input parameters | Source: FastAPI |
| `403` | Forbidden - insufficient permissions | Source: FastAPI |
| `500` | Internal server error | Source: FastAPI |


**Response Examples by Status Code:**

**200 OK:**
```json
{
  "type": {
    "id": 1,
    "name": "Sample type"
  },
  "properties": "sample_properties"
}
```

**400 Bad Request:**
```json
{
  "error": "Error 400: Bad Request",
  "status_code": 400
}
```

**403 Forbidden:**
```json
{
  "error": "Error 403: Forbidden",
  "status_code": 403
}
```

**500 Internal Server Error:**
```json
{
  "error": "Error 500: Internal Server Error",
  "status_code": 500
}
```


**Code Examples:**

**cURL:**
```bash
curl -X POST '/{group_id}/messages' \
  -H 'Authorization: Token <token> YOUR_TOKEN'
```

**Python (requests):**
```python
import requests

url = '/{group_id}/messages'
headers = {
    'Authorization': 'Token <token> YOUR_TOKEN',
}

response = requests.post(url, headers=headers)
print(response.json())
```

**JavaScript (fetch):**
```javascript
const url = '/{group_id}/messages';
const options = {
  method: 'POST',
  headers: {
    'Authorization': 'Token <token> YOUR_TOKEN',
  }
};

fetch(url, options)
  .then(response => response.json())
  .then(data => console.log(data));
```

---

*Source: `backend/app/routes/groups.py`*

### Profiles

#### GET – Fetch Resource

*Retrieve operations using the GET method*

#### Get User Profile

**Method:** GET
**Endpoint:** `/profile/by-id/{user_id}`

🔄 **Idempotent:** This operation is idempotent - multiple identical requests have the same effect as a single request.

**Description:** This endpoint retrieves a user's display name based on their user ID.

**Request Headers:**

| Header | Required | Value |
|:-------|:--------:|:------|
| Authorization | Yes | Token |

**Path Parameters:**

| Parameter | Type | Required | Description |
|:----------|:----:|:--------:|:------------|
| `user_id` | integer (long) | Yes | Resource identifier |

**Query Parameters:**

| Name | Type | Required | Description |
|:-----|:----:|:--------:|:------------|
| `db` | string | No | Query parameter |

**Response**

**Status Code:** `200 OK`

```json
{
  "type": "object",
  "properties": {
    "display_name": {
      "type": "string",
      "example": "English"
    }
  }
}
```

**Possible Status Codes:**

| Status Code | Scenario | Description |
|:------------|:---------|:------------|
| `200` | Successful request | Successful request |
| `500` | Internal server error | Source: FastAPI |


**Response Examples by Status Code:**

**200 OK:**
```json
{
  "type": "object",
  "properties": {
    "display_name": {
      "type": "string",
      "example": "English"
    }
  }
}
```

**500 Internal Server Error:**
```json
{
  "error": "Error 500: Internal Server Error",
  "status_code": 500
}
```


**Code Examples:**

**cURL:**
```bash
curl -X GET '/profile/by-id/{user_id}' \
  -H 'Authorization: Token <token> YOUR_TOKEN'
```

**Python (requests):**
```python
import requests

url = '/profile/by-id/{user_id}'
headers = {
    'Authorization': 'Token <token> YOUR_TOKEN',
}

response = requests.get(url, headers=headers)
print(response.json())
```

**JavaScript (fetch):**
```javascript
const url = '/profile/by-id/{user_id}';
const options = {
  method: 'GET',
  headers: {
    'Authorization': 'Token <token> YOUR_TOKEN',
  }
};

fetch(url, options)
  .then(response => response.json())
  .then(data => console.log(data));
```

---

*Source: `backend/app/routes/users.py`*

### Test-users-routes

#### GET – Fetch Resource

*Retrieve operations using the GET method*

#### Test Users Route

**Method:** GET
**Endpoint:** `/test-users-route`

🔄 **Idempotent:** This operation is idempotent - multiple identical requests have the same effect as a single request.

**Description:** The /test-users-route endpoint serves as a verification point to confirm that the users router is correctly loaded in the application.

**Request Headers:**

| Header | Required | Value |
|:-------|:--------:|:------|
| Authorization | Yes | Token |

**Response**

**Status Code:** `200 OK`

```json
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "example": "example_message"
    },
    "routes": {
      "type": "array",
      "example": []
    }
  }
}
```

**Code Examples:**

**cURL:**
```bash
curl -X GET '/test-users-route' \
  -H 'Authorization: Token <token> YOUR_TOKEN'
```

**Python (requests):**
```python
import requests

url = '/test-users-route'
headers = {
    'Authorization': 'Token <token> YOUR_TOKEN',
}

response = requests.get(url, headers=headers)
print(response.json())
```

**JavaScript (fetch):**
```javascript
const url = '/test-users-route';
const options = {
  method: 'GET',
  headers: {
    'Authorization': 'Token <token> YOUR_TOKEN',
  }
};

fetch(url, options)
  .then(response => response.json())
  .then(data => console.log(data));
```

---

*Source: `backend/app/main.py`*

### Users

#### GET – Fetch Resource

*Retrieve operations using the GET method*

#### Get Current User Profile

**Method:** GET
**Endpoint:** `/users/me`

🔄 **Idempotent:** This operation is idempotent - multiple identical requests have the same effect as a single request.

**Description:** The GET /users/me endpoint retrieves the profile information of the currently authenticated user.

**Request Headers:**

| Header | Required | Value |
|:-------|:--------:|:------|
| Authorization | Yes | Token |

**Query Parameters:**

| Name | Type | Required | Description |
|:-----|:----:|:--------:|:------------|
| `user_id` | string | No | Query parameter |
| `db` | string | No | Query parameter |

**Response**

**Status Code:** `200 OK`

```json
{
  "type": "object",
  "properties": {
    "user_id": {
      "type": "string",
      "example": "20"
    },
    "display_name": {
      "type": "string",
      "example": "English"
    }
  }
}
```

**Possible Status Codes:**

| Status Code | Scenario | Description |
|:------------|:---------|:------------|
| `200` | Successful request | Successful request |
| `500` | Internal server error | Source: FastAPI |


**Response Examples by Status Code:**

**200 OK:**
```json
{
  "type": "object",
  "properties": {
    "user_id": {
      "type": "string",
      "example": "20"
    },
    "display_name": {
      "type": "string",
      "example": "English"
    }
  }
}
```

**500 Internal Server Error:**
```json
{
  "error": "Error 500: Internal Server Error",
  "status_code": 500
}
```


**Code Examples:**

**cURL:**
```bash
curl -X GET '/users/me' \
  -H 'Authorization: Token <token> YOUR_TOKEN'
```

**Python (requests):**
```python
import requests

url = '/users/me'
headers = {
    'Authorization': 'Token <token> YOUR_TOKEN',
}

response = requests.get(url, headers=headers)
print(response.json())
```

**JavaScript (fetch):**
```javascript
const url = '/users/me';
const options = {
  method: 'GET',
  headers: {
    'Authorization': 'Token <token> YOUR_TOKEN',
  }
};

fetch(url, options)
  .then(response => response.json())
  .then(data => console.log(data));
```

---

*Source: `backend/app/main.py`*

#### PUT – Replace Resource

*Replace operations using the PUT method*

#### Update Current User Profile

**Method:** PUT
**Endpoint:** `/users/me`

🔄 **Idempotent:** This operation is idempotent - multiple identical requests have the same effect as a single request.

**Description:** The PUT /users/me endpoint allows authenticated users to update their profile information, specifically their display name.

**Request Headers:**

| Header | Required | Value |
|:-------|:--------:|:------|
| Authorization | Yes | Token |

**Response**

**Status Code:** `200 OK`

```json
{
  "type": "object",
  "properties": {
    "user_id": {
      "type": "string",
      "example": "20"
    },
    "display_name": {
      "type": "string",
      "example": "English"
    }
  }
}
```

**Possible Status Codes:**

| Status Code | Scenario | Description |
|:------------|:---------|:------------|
| `200` | Successful request | Successful request |
| `400` | Bad request - invalid input parameters | Source: FastAPI |
| `500` | Internal server error | Source: FastAPI |


**Response Examples by Status Code:**

**200 OK:**
```json
{
  "type": "object",
  "properties": {
    "user_id": {
      "type": "string",
      "example": "20"
    },
    "display_name": {
      "type": "string",
      "example": "English"
    }
  }
}
```

**400 Bad Request:**
```json
{
  "error": "Error 400: Bad Request",
  "status_code": 400
}
```

**500 Internal Server Error:**
```json
{
  "error": "Error 500: Internal Server Error",
  "status_code": 500
}
```


**Code Examples:**

**cURL:**
```bash
curl -X PUT '/users/me' \
  -H 'Authorization: Token <token> YOUR_TOKEN'
```

**Python (requests):**
```python
import requests

url = '/users/me'
headers = {
    'Authorization': 'Token <token> YOUR_TOKEN',
}

response = requests.put(url, headers=headers)
print(response.json())
```

**JavaScript (fetch):**
```javascript
const url = '/users/me';
const options = {
  method: 'PUT',
  headers: {
    'Authorization': 'Token <token> YOUR_TOKEN',
  }
};

fetch(url, options)
  .then(response => response.json())
  .then(data => console.log(data));
```

---

*Source: `backend/app/main.py`*

#### GET – Fetch Resource

*Retrieve operations using the GET method*

#### Root

**Method:** GET
**Endpoint:** `/`

🔄 **Idempotent:** This operation is idempotent - multiple identical requests have the same effect as a single request.

**Description:** The root endpoint serves as a health check for the CircleChat API, confirming that the service is operational.

**Request Headers:**

| Header | Required | Value |
|:-------|:--------:|:------|
| Authorization | Yes | Token |

**Response**

**Status Code:** `200 OK`

```json
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "example": "example_message"
    }
  }
}
```

**Code Examples:**

**cURL:**
```bash
curl -X GET '/' \
  -H 'Authorization: Token <token> YOUR_TOKEN'
```

**Python (requests):**
```python
import requests

url = '/'
headers = {
    'Authorization': 'Token <token> YOUR_TOKEN',
}

response = requests.get(url, headers=headers)
print(response.json())
```

**JavaScript (fetch):**
```javascript
const url = '/';
const options = {
  method: 'GET',
  headers: {
    'Authorization': 'Token <token> YOUR_TOKEN',
  }
};

fetch(url, options)
  .then(response => response.json())
  .then(data => console.log(data));
```

---

*Source: `backend/app/main.py`*


---

#### Get Group

**Method:** GET
**Endpoint:** `/{group_id}`

🔄 **Idempotent:** This operation is idempotent - multiple identical requests have the same effect as a single request.

**Description:** This endpoint retrieves detailed information about a specific group identified by the group_id.

**Request Headers:**

| Header | Required | Value |
|:-------|:--------:|:------|
| Authorization | Yes | Token |

**Path Parameters:**

| Parameter | Type | Required | Description |
|:----------|:----:|:--------:|:------------|
| `group_id` | integer (long) | Yes | Resource identifier |

**Query Parameters:**

| Name | Type | Required | Description |
|:-----|:----:|:--------:|:------------|
| `user_id` | string | No | Query parameter |
| `db` | string | No | Query parameter |

**Response**

**Status Code:** `200 OK`

```json
{
  "id": "60d5ec49f1a2c8b2a8e0c1f4",
  "name": "Sample Group",
  "description": "This is a sample group description.",
  "owner_id": "user_123",
  "member_count": 5,
  "created_at": "2023-01-01T12:00:00Z",
  "updated_at": "2023-01-10T12:00:00Z",
  "members": [
    {
      "user_id": "user_456",
      "display_name": "John Doe",
      "email": "john.doe@example.com"
    },
    {
      "user_id": "user_789",
      "display_name": "Jane Smith",
      "email": "jane.smith@example.com"
    }
  ]
}
```

**Possible Status Codes:**

| Status Code | Scenario | Description |
|:------------|:---------|:------------|
| `200` | Successful request | Successful request |
| `400` | Bad request - invalid input parameters | Source: FastAPI |
| `403` | Forbidden - insufficient permissions | Source: FastAPI |
| `404` | Resource not found | Source: FastAPI |
| `500` | Internal server error | Source: FastAPI |


**Response Examples by Status Code:**

**200 OK:**
```json
{
  "id": "60d5ec49f1a2c8b2a8e0c1f4",
  "name": "Sample Group",
  "description": "This is a sample group description.",
  "owner_id": "user_123",
  "member_count": 5,
  "created_at": "2023-01-01T12:00:00Z",
  "updated_at": "2023-01-10T12:00:00Z",
  "members": [
    {
      "user_id": "user_456",
      "display_name": "John Doe",
      "email": "john.doe@example.com"
    },
    {
      "user_id": "user_789",
      "display_name": "Jane Smith",
      "email": "jane.smith@example.com"
    }
  ]
}
```

**400 Bad Request:**
```json
{
  "error": "Error 400: Bad Request",
  "status_code": 400
}
```

**403 Forbidden:**
```json
{
  "error": "Error 403: Forbidden",
  "status_code": 403
}
```

**404 Not Found:**
```json
{
  "error": "Error 404: Not Found",
  "status_code": 404
}
```

**500 Internal Server Error:**
```json
{
  "error": "Error 500: Internal Server Error",
  "status_code": 500
}
```


**Code Examples:**

**cURL:**
```bash
curl -X GET '/{group_id}' \
  -H 'Authorization: Token <token> YOUR_TOKEN'
```

**Python (requests):**
```python
import requests

url = '/{group_id}'
headers = {
    'Authorization': 'Token <token> YOUR_TOKEN',
}

response = requests.get(url, headers=headers)
print(response.json())
```

**JavaScript (fetch):**
```javascript
const url = '/{group_id}';
const options = {
  method: 'GET',
  headers: {
    'Authorization': 'Token <token> YOUR_TOKEN',
  }
};

fetch(url, options)
  .then(response => response.json())
  .then(data => console.log(data));
```

---

*Source: `backend/app/routes/groups.py`*


---

#### Get Invite

**Method:** GET
**Endpoint:** `/{invite_code}`

🔄 **Idempotent:** This operation is idempotent - multiple identical requests have the same effect as a single request.

**Description:** The GET /{invite_code} endpoint retrieves the details of a specific invite using its unique invite code.

**Request Headers:**

| Header | Required | Value |
|:-------|:--------:|:------|
| Authorization | Yes | Token |

**Path Parameters:**

| Parameter | Type | Required | Description |
|:----------|:----:|:--------:|:------------|
| `invite_code` | string | Yes | Resource identifier |

**Query Parameters:**

| Name | Type | Required | Description |
|:-----|:----:|:--------:|:------------|
| `db` | string | No | Query parameter |

**Response**

**Status Code:** `200 OK`

```json
{
  "type": "object",
  "properties": {
    "code": {
      "type": "string",
      "example": "en"
    },
    "group_id": {
      "type": "string",
      "example": "20"
    },
    "group_name": {
      "type": "string",
      "example": "English"
    },
    "expires_at": {
      "type": "string",
      "example": "example_expires_at"
    }
  }
}
```

**Possible Status Codes:**

| Status Code | Scenario | Description |
|:------------|:---------|:------------|
| `200` | Successful request | Successful request |
| `404` | Resource not found | Source: FastAPI |
| `410` | HTTP 410 response | Source: FastAPI |
| `500` | Internal server error | Source: FastAPI |


**Response Examples by Status Code:**

**200 OK:**
```json
{
  "type": "object",
  "properties": {
    "code": {
      "type": "string",
      "example": "en"
    },
    "group_id": {
      "type": "string",
      "example": "20"
    },
    "group_name": {
      "type": "string",
      "example": "English"
    },
    "expires_at": {
      "type": "string",
      "example": "example_expires_at"
    }
  }
}
```

**404 Not Found:**
```json
{
  "error": "Error 404: Not Found",
  "status_code": 404
}
```

**410 :**
```json
{
  "error": "Error 410: ",
  "status_code": 410
}
```

**500 Internal Server Error:**
```json
{
  "error": "Error 500: Internal Server Error",
  "status_code": 500
}
```


**Code Examples:**

**cURL:**
```bash
curl -X GET '/{invite_code}' \
  -H 'Authorization: Token <token> YOUR_TOKEN'
```

**Python (requests):**
```python
import requests

url = '/{invite_code}'
headers = {
    'Authorization': 'Token <token> YOUR_TOKEN',
}

response = requests.get(url, headers=headers)
print(response.json())
```

**JavaScript (fetch):**
```javascript
const url = '/{invite_code}';
const options = {
  method: 'GET',
  headers: {
    'Authorization': 'Token <token> YOUR_TOKEN',
  }
};

fetch(url, options)
  .then(response => response.json())
  .then(data => console.log(data));
```

---

*Source: `backend/app/routes/invites.py`*


---

## 6. Rate Limiting

**Rate Limiting:** Enabled

* **User:** 100/minute

### Rate Limit Headers

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Total allowed requests per minute |

### Retry Strategy

When rate limited (429 status), wait for the time specified in `Retry-After` header.

---

## 7. Versioning Strategy

* **Strategy:** URL-based
* **Current Version:** v1

### Available Versions

* `v1`

---

## 8. Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-06-08 | Initial release with Users endpoints, Messages endpoints, Me endpoints |

---

## API Documentation Best Practices

* Use nouns instead of verbs in URLs
* Return correct HTTP status codes
* Keep response formats consistent
* Always include example requests and responses
* Clearly document validation rules and edge cases
