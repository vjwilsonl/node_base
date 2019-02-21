import React from 'react';
import { BrowserRouter, Route } from 'react-router-dom';

const Header = () => <h2>Header</h2>;
const Dashboard = () => <h2>Dashboard</h2>;
const Profile = () => <h2>Profile</h2>;

const App = () => {
  return (
    <div>
      <BrowserRouter>
        <div>
          <Header /> {/* show at all times */}
          <Route exact path="/" component={Dashboard} />
          <Route path="/profile" component={Profile} />
        </div>
      </BrowserRouter>
    </div>
  );
};

export default App;
