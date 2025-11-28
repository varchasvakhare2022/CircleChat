import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { groupsAPI } from '../services/api';
import './creategroup.css';

const CreateGroup = () => {
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const group = await groupsAPI.createGroup(formData.name, formData.description);
      navigate(`/group/${group.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/groups');
  };

  return (
    <div className="create-group-container">
      <div className="create-group-card">
        <h2>Create New Group</h2>
        <form onSubmit={handleSubmit} className="create-group-form">
          <div className="form-group">
            <label htmlFor="name">Group Name</label>
            <input
              type="text"
              id="name"
              name="name"
              placeholder="Enter group name"
              value={formData.name}
              onChange={handleChange}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description (Optional)</label>
            <textarea
              id="description"
              name="description"
              placeholder="What is this group about?"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className="form-textarea"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button
              type="button"
              onClick={handleCancel}
              className="cancel-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="submit-button"
            >
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGroup;

