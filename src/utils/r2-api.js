class R2API {
  constructor(config) {
    this.apiUrl = config.apiUrl;
  }

  async putObject(key, data) {
    const response = await fetch(`${this.apiUrl}/api/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key, data })
    });

    if (!response.ok) {
      throw new Error(`R2 API PUT failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getObject(key) {
    const response = await fetch(`${this.apiUrl}/api/load?key=${encodeURIComponent(key)}`, {
      method: 'GET'
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`R2 API GET failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async deleteObject(key) {
    const response = await fetch(`${this.apiUrl}/api/delete`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key })
    });

    if (!response.ok) {
      throw new Error(`R2 API DELETE failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async listObjects(prefix = '') {
    const response = await fetch(`${this.apiUrl}/api/list?prefix=${encodeURIComponent(prefix)}`, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`R2 API LIST failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result.objects || [];
  }

  async batchSave(mediaUsages, mode = 'preview') {
    const response = await fetch(`${this.apiUrl}/api/batch-save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mediaUsages, mode })
    });

    if (!response.ok) {
      throw new Error(`R2 API BATCH SAVE failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async batchLoad(keys) {
    const response = await fetch(`${this.apiUrl}/api/batch-load`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ keys })
    });

    if (!response.ok) {
      throw new Error(`R2 API BATCH LOAD failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result.results || [];
  }

  async batchDelete(keys) {
    const response = await fetch(`${this.apiUrl}/api/batch-delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ keys })
    });

    if (!response.ok) {
      throw new Error(`R2 API BATCH DELETE failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

export default R2API;