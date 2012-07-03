"""
A parser for .ini-syntax files.  INIParser should be subclassed to
create a data structure from the file.  See INIParser for more
"""


class ParseError(Exception):

    def __init__(self, message, filename=None, lineno=None, column=None, line=None):
        # Note: right now column is not used, but in some contexts it
        # could be used to print out a line like:
        # error, must be an integer:
        # a = one
        #     ^
        self.message = message
        self.filename = filename
        self.lineno = lineno
        self.column = column
        self.line = line

    def __str__(self):
        msg = self.message
        if self.filename and self.lineno:
            msg += ' in %s:%s' % (self.filename, self.lineno)
        elif self.filename:
            msg += ' in %s' % self.filename
        elif self.lineno:
            msg += ' at line %s' % self.lineno
        return msg


class INIParser(object):

    """
    A parser for .ini-syntax files.

    Implements all features I know of in .ini files:

    * sections with a [ in the first column
    * assignment via a=b or a: b
    * rfc822-style continuation lines (i.e., start the next line
      with indentation to make it a continuation).
    * ; or # for comments

    This class should be subclassed.  Subclasses may only need to
    implement the .assignment() method.  You may want to use the
    .section attribute, which holds the current section (or None if no
    section has been defined yet).

    Use .parse_error(message) when you encounter a problem; this will
    create an exception that will note the filename and line in which
    the problem occurs.
    """

    def __init__(self, save_leading_whitespace=False, assignment_chars=('=', ':')):
        self.reset()
        self.save_leading_whitespace = save_leading_whitespace
        self.assignment_chars = assignment_chars

    def reset(self):
        pass

    def load(self, filename, encoding=None):
        fileobj = open(filename, 'rb')
        self.loadfile(fileobj, filename=filename, encoding=encoding)
        fileobj.close()

    def loadfile(self, fileobj, filename=None, encoding=None):
        self.start_lineno = 0
        if filename is None:
            filename = getattr(fileobj, 'name', None)
        self.filename = filename
        # lineno is what we are parsing, start_lineno is the last
        # assignment we processed (for multi-line assignments)
        self.start_lineno = 0
        self.lineno = 0
        self.encoding = encoding

        def strip_newline(l):
            if l.endswith('\n'):
                return l[:-1]
            else:
                return l

        self.stream = [strip_newline(l) for l in fileobj.readlines()]
        self.process_file()
        del self.filename
        del self.encoding
        del self.lineno

    def loadstring(self, string, filename=None):
        self.stream = string.splitlines()
        self.filename = filename
        self.start_lineno = 0
        self.lineno = 0
        self.encoding = None
        self.process_file()
        del self.stream
        del self.filename
        del self.lineno
        del self.encoding

    def process_file(self):
        self.section = None
        last_name = None
        accumulated_content = None
        for line in self.stream:
            self.lineno += 1
            # @@: should catch encoding error:
            if self.encoding:
                line = line.decode(self.encoding)
            if not line.strip():  # empty line
                if last_name is not None:
                    self.process_assignment(
                        last_name,
                        accumulated_content)
                    last_name = accumulated_content = None
                    self.start_lineno = self.lineno
                continue
            elif line[0] in (' ', '\t'):  # continuation line
                if not last_name:
                    self.error_continuation_without_assignment(line)
                else:
                    accumulated_content.append(line)
                continue
            elif self.get_section(line) is not None:  # section line
                if last_name is not None:
                    self.process_assignment(
                        last_name,
                        accumulated_content)
                    last_name = accumulated_content = None
                    self.start_lineno = self.lineno
                self.new_section(self.get_section(line))
            elif self.get_comment(line) is not None:  # comment line
                if last_name is not None:
                    self.process_assignment(
                        last_name,
                        accumulated_content)
                    last_name = accumulated_content = None
                    self.start_lineno = self.lineno
                self.add_comment(self.get_comment(line))
            else:  # normal assignment
                if last_name is not None:
                    self.process_assignment(
                        last_name,
                        accumulated_content)
                last_name, accumulated_content = self.split_name_value(line)
                self.start_lineno = self.lineno
        if last_name is not None:
            self.process_assignment(
                last_name,
                accumulated_content)

    def split_name_value(self, line):
        positions = [(line.find(c), c) for c in self.assignment_chars
                     if c in line != -1]
        if not positions:
            self.error_missing_equal(line)
        pos = min(positions)[0]
        return line[:pos], [line[pos + 1:]]

    def get_comment(self, line):
        """
        Returns None if not a comment
        """
        line = line.lstrip()
        if line.startswith(';') or line.startswith('#'):
            return line[1:]
        return None

    def get_section(self, line):
        """
        Returns None if not a section
        """
        line = line.strip()
        if not line.startswith('['):
            return None
        if not line.endswith(']'):
            self.error_section_without_end_bracket(line)
            return None
        return line[1:-1]

    def process_assignment(self, name, accumulated_content):
        if self.save_leading_whitespace:
            if not accumulated_content:
                content = ''
            else:
                min_space = min(
                    (len(line) - len(line.lstrip()))
                    for line in accumulated_content)
                content = '\n'.join(
                    line[min_space:] for line in accumulated_content)
        else:
            content = '\n'.join([l.lstrip() for l in accumulated_content])
        self.assignment(name.strip(), content)

    def assignment(self, name, content):
        raise NotImplementedError

    def new_section(self, section):
        if not section:
            self.error_no_section_name()
        self.section = section

    def add_comment(self, comment):
        pass

    def error_continuation_without_assignment(self, line):
        self.parse_error('Invalid indentation', line)

    def error_section_without_end_bracket(self, line):
        self.parse_error('Invalid section (must end with ])', line)

    def error_missing_equal(self, line):
        self.parse_error(
            'Lines should look like "name=value" or "name: value"',
            line)

    def error_no_section_name(self):
        self.parse_error(
            'Empty section name ([])')

    def parse_error(self, msg, line=None, exception=None):
        if exception is None:
            exception = ParseError
        raise exception(
            msg,
            filename=self.filename,
            lineno=self.lineno,
            line=line)


class BasicParser(INIParser):

    """
    A simple subclass of INIParser; creates a nested data structure
    like ``{'section_name': {'variable': ['values']}}``

    Usage::

        >>> p = BasicParser()
        >>> p.load('config.ini')
        >>> data = p.data
    """

    def reset(self):
        self.data = {}
        INIParser.reset(self)

    def assignment(self, name, content):
        if not self.section:
            self.parse_error(
                'Assignments can only occur inside sections; no section has been defined yet')
        section = self.data.setdefault(self.section, {})
        section.setdefault(name, []).append(content)
