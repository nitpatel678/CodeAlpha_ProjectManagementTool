// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/projecthub', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Project Schema
const projectSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now }
});

const Project = mongoose.model('Project', projectSchema);

// Task Schema
const taskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['todo', 'inprogress', 'done'], default: 'todo' },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Task = mongoose.model('Task', taskSchema);

// Comment Schema
const commentSchema = new mongoose.Schema({
    text: { type: String, required: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
});

const Comment = mongoose.model('Comment', commentSchema);

// Notification Schema
const notificationSchema = new mongoose.Schema({
    title: { type: String, required: true },
    message: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['task_assigned', 'task_updated', 'comment_added', 'project_invitation'], required: true },
    read: { type: Boolean, default: false },
    relatedTask: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    relatedProject: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    createdAt: { type: Date, default: Date.now }
});

const Notification = mongoose.model('Notification', notificationSchema);

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Helper function to create notifications
const createNotification = async (userId, title, message, type, relatedTask = null, relatedProject = null) => {
    try {
        const notification = new Notification({
            title,
            message,
            user: userId,
            type,
            relatedTask,
            relatedProject
        });
        await notification.save();
    } catch (error) {
        console.error('Error creating notification:', error);
    }
};

// Helper function to find user by email
const findUserByEmail = async (email) => {
    return await User.findOne({ email });
};

// Routes

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = new User({
            username,
            email,
            password: hashedPassword
        });

        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, username: user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'User created successfully',
            token,
            user: { _id: user._id, username: user.username, email: user.email }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Find user
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, username: user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: { _id: user._id, username: user.username, email: user.email }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Project Routes
app.get('/api/projects', authenticateToken, async (req, res) => {
    try {
        const projects = await Project.find({
            $or: [
                { owner: req.user.userId },
                { members: req.user.userId }
            ]
        }).populate('members', 'username email').populate('owner', 'username email');

        // Add task count to each project
        const projectsWithTaskCount = await Promise.all(
            projects.map(async (project) => {
                const taskCount = await Task.countDocuments({ project: project._id });
                return {
                    ...project.toObject(),
                    taskCount
                };
            })
        );

        res.json(projectsWithTaskCount);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/projects', authenticateToken, async (req, res) => {
    try {
        const { name, description, members } = req.body;

        // Find member users by email
        const memberUsers = [];
        if (members && members.length > 0) {
            for (const email of members) {
                const user = await findUserByEmail(email);
                if (user) {
                    memberUsers.push(user._id);
                    // Create notification for invited members
                    await createNotification(
                        user._id,
                        'Project Invitation',
                        `You've been added to project: ${name}`,
                        'project_invitation'
                    );
                }
            }
        }

        const project = new Project({
            name,
            description,
            owner: req.user.userId,
            members: memberUsers
        });

        await project.save();
        await project.populate('members', 'username email');

        res.status(201).json(project);
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/projects/:id', authenticateToken, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate('members', 'username email')
            .populate('owner', 'username email');

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Check if user is member or owner
        if (project.owner._id.toString() !== req.user.userId && 
            !project.members.some(member => member._id.toString() === req.user.userId)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json(project);
    } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Task Routes
app.get('/api/projects/:projectId/tasks', authenticateToken, async (req, res) => {
    try {
        const { projectId } = req.params;

        // Check if user has access to project
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        if (project.owner.toString() !== req.user.userId && 
            !project.members.includes(req.user.userId)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const tasks = await Task.find({ project: projectId })
            .populate('assignee', 'username email')
            .populate('createdBy', 'username email')
            .sort({ createdAt: -1 });

        res.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/projects/:projectId/tasks', authenticateToken, async (req, res) => {
    try {
        const { projectId } = req.params;
        const { title, description, assignee, status, priority } = req.body;

        // Check if user has access to project
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        if (project.owner.toString() !== req.user.userId && 
            !project.members.includes(req.user.userId)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const task = new Task({
            title,
            description,
            project: projectId,
            assignee: assignee || null,
            status: status || 'todo',
            priority: priority || 'medium',
            createdBy: req.user.userId
        });

        await task.save();
        await task.populate('assignee', 'username email');
        await task.populate('createdBy', 'username email');

        // Create notification for assignee
        if (assignee && assignee !== req.user.userId) {
            await createNotification(
                assignee,
                'Task Assigned',
                `You've been assigned a new task: ${title}`,
                'task_assigned',
                task._id,
                projectId
            );
        }

        res.status(201).json(task);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.put('/api/projects/:projectId/tasks/:taskId', authenticateToken, async (req, res) => {
    try {
        const { projectId, taskId } = req.params;
        const { title, description, assignee, status, priority } = req.body;

        // Check if user has access to project
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        if (
            project.owner.toString() !== req.user.userId &&
            !project.members.includes(req.user.userId)
        ) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const oldTask = await Task.findById(taskId);
        if (!oldTask) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // 🔹 Restrict editing to task creator only
        if (oldTask.createdBy.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'Only the user who created this task can edit it.' });
        }

        const task = await Task.findByIdAndUpdate(
            taskId,
            {
                title,
                description,
                assignee: assignee || null,
                status: status || 'todo',
                priority: priority || 'medium',
                updatedAt: new Date(),
            },
            { new: true }
        )
            .populate('assignee', 'username email')
            .populate('createdBy', 'username email');

        // Create notifications for changes
        if (assignee && assignee !== oldTask.assignee?.toString()) {
            await createNotification(
                assignee,
                'Task Updated',
                `You've been assigned to task: ${title}`,
                'task_assigned',
                task._id,
                projectId
            );
        }

        if (status !== oldTask.status && oldTask.assignee) {
            await createNotification(
                oldTask.assignee,
                'Task Status Updated',
                `Task "${title}" status changed to ${status}`,
                'task_updated',
                task._id,
                projectId
            );
        }

        res.json(task);
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


app.delete('/api/projects/:projectId/tasks/:taskId', authenticateToken, async (req, res) => {
    try {
        const { projectId, taskId } = req.params;

        // Check if user has access to project
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        if (project.owner.toString() !== req.user.userId && 
            !project.members.includes(req.user.userId)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Delete associated comments
        await Comment.deleteMany({ task: taskId });

        // Delete the task
        await Task.findByIdAndDelete(taskId);

        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Comment Routes
app.get('/api/tasks/:taskId/comments', authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;

        // Check if user has access to the task
        const task = await Task.findById(taskId).populate('project');
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        const project = task.project;
        if (project.owner.toString() !== req.user.userId && 
            !project.members.includes(req.user.userId)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const comments = await Comment.find({ task: taskId })
            .populate('author', 'username email')
            .sort({ createdAt: 1 });

        res.json(comments);
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/tasks/:taskId/comments', authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;
        const { text } = req.body;

        // Check if user has access to the task
        const task = await Task.findById(taskId).populate('project');
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        const project = task.project;
        if (project.owner.toString() !== req.user.userId && 
            !project.members.includes(req.user.userId)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const comment = new Comment({
            text,
            task: taskId,
            author: req.user.userId
        });

        await comment.save();
        await comment.populate('author', 'username email');

        // Create notification for task assignee (if not the commenter)
        if (task.assignee && task.assignee.toString() !== req.user.userId) {
            await createNotification(
                task.assignee,
                'New Comment',
                `${req.user.username} commented on task: ${task.title}`,
                'comment_added',
                task._id,
                project._id
            );
        }

        // Create notification for task creator (if not the commenter and not the assignee)
        if (task.createdBy.toString() !== req.user.userId && 
            task.createdBy.toString() !== task.assignee?.toString()) {
            await createNotification(
                task.createdBy,
                'New Comment',
                `${req.user.username} commented on task: ${task.title}`,
                'comment_added',
                task._id,
                project._id
            );
        }

        res.status(201).json(comment);
    } catch (error) {
        console.error('Error creating comment:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Notification Routes
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const notifications = await Notification.find({ user: req.user.userId })
            .sort({ createdAt: -1 })
            .limit(50);

        res.json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.put('/api/notifications/:notificationId/read', authenticateToken, async (req, res) => {
    try {
        const { notificationId } = req.params;

        const notification = await Notification.findOneAndUpdate(
            { _id: notificationId, user: req.user.userId },
            { read: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        res.json(notification);
    } catch (error) {
        console.error('Error updating notification:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.put('/api/notifications/read-all', authenticateToken, async (req, res) => {
    try {
        await Notification.updateMany(
            { user: req.user.userId, read: false },
            { read: true }
        );

        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// User search route for adding members
app.get('/api/users/search', authenticateToken, async (req, res) => {
    try {
        const { query } = req.query;
        
        if (!query || query.length < 2) {
            return res.json([]);
        }

        const users = await User.find({
            $or: [
                { username: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } }
            ]
        }).select('username email').limit(10);

        res.json(users);
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Serve the frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ message: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Frontend available at: http://localhost:${PORT}`);
});

module.exports = app;