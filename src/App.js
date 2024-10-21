import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import EditProject from './components/EditProject';
import ProjectHome from './components/ProjectHome';
import Login from './components/Login';
import NewProject from './components/NewProject';
import Register from './components/Register';
import Documentation from './components/Documentation';
import News from './components/News';
import About from './components/About';
import Contact from './components/Contact';

const App = () => {
  return (
    <Router>
      <Switch>
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/projects/:projectId/edit" component={EditProject} />
        <Route path="/projects/:projectId" component={ProjectHome} />
        <Route path="/auth/login" component={Login} />
        <Route path="/newProject" component={NewProject} />
        <Route path="/auth/register" component={Register} />
        <Route path="/documentation" component={Documentation} />
        <Route path="/news" component={News} />
        <Route path="/about" component={About} />
        <Route path="/contact" component={Contact} />
        <Route path="/" component={Dashboard} />
      </Switch>
    </Router>
  );
};

export default App;
